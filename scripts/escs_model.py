"""Модель для оцінки рівня достатку (ESCS) з семи простих питань — для калькулятора.

Індекс ESCS у PISA 2025 для України точно (R² = 1) складається з трьох частин:
    ESCS = b0 + bP * PAREDINT + bI * HISEI + bH * HOMEPOS
PAREDINT (роки освіти батьків) — однозначно з питання про освіту.
HISEI (статус професії) — середнє значення для обраної групи професій (ISCO-08, перша цифра).
HOMEPOS (речі вдома) — оцінка з п'яти питань (книжки, автомобілі, туалети, ноутбуки, телевізори).
Рівень = у яку третину національного розподілу ESCS потрапляє оцінка (ті самі межі, що в калькуляторі).

Використання: python escs_model.py <CY09_MS_STU_PUF.sav> <вихідний escs_model.json>
"""
import sys, json
import numpy as np, pandas as pd, pyreadstat

SRC, OUT = sys.argv[1], sys.argv[2]
HOME = {  # питання → змінна PISA
    'books': 'ST255Q01JA', 'cars': 'ST251Q01JA', 'toilets': 'ST251Q04JA', 'laptops': 'ST254Q03JA', 'tvs': 'ST254Q01JA',
}
cols = ['CNT', 'ESCS', 'PAREDINT', 'HISEI', 'HOMEPOS', 'HISCED', 'OCOP1', 'OCOP2', 'BP1MJ', 'BP2MJ', 'W_FSTUWT'] + list(HOME.values())
parts = []
for ch, _ in pyreadstat.read_file_in_chunks(pyreadstat.read_sav, SRC, chunksize=100000, usecols=cols, apply_value_formats=False):
    parts.append(ch[ch.CNT == 'QUA'])
u = pd.concat(parts, ignore_index=True)
W = 'W_FSTUWT'


def wmean(x, w):
    ok = x.notna()
    return float(np.average(x[ok], weights=w[ok]))


def wls(X, y, w):
    b = np.linalg.lstsq(X * np.sqrt(w)[:, None], y * np.sqrt(w), rcond=None)[0]
    return b


# ---------- 1. Формула ESCS
c = u.dropna(subset=['ESCS', 'PAREDINT', 'HISEI', 'HOMEPOS'])
X = np.column_stack([np.ones(len(c)), c.PAREDINT, c.HISEI, c.HOMEPOS])
b0, bP, bI, bH = wls(X, c.ESCS.values, c[W].values)

# ---------- 2. Межі рівнів (зважені третини, як у calculator_table.py)
e = u.dropna(subset=['ESCS'])
order = e.ESCS.sort_values().index
cw = e[W][order].cumsum() / e[W].sum()
cuts = [float(e.ESCS[order][cw <= q].iloc[-1]) for q in (1 / 3, 2 / 3)]

# ---------- 3. Освіта батьків → роки (PAREDINT)
EDU = {'basic': [1, 2], 'secondary': [3, 4, 5], 'college': [6], 'university': [7, 8, 9]}
education = {k: round(wmean(u.PAREDINT[u.HISCED.isin(v)], u[W][u.HISCED.isin(v)]), 2) for k, v in EDU.items()}
education['unknown'] = round(wmean(u.PAREDINT, u[W]), 2)

# ---------- 4. Професія → статус (HISEI); група — того з батьків, у кого статус вищий
def major(code):
    if pd.isna(code):
        return None
    s = str(code)
    s = s[:-2] if s.endswith('.0') else s
    if not s.isdigit() or len(s) > 2 or s in ('97', '98', '99'):
        return None
    return s[0]

b1, b2 = u.BP1MJ.where(u.BP1MJ < 900), u.BP2MJ.where(u.BP2MJ < 900)
u['occ'] = np.where(b1.fillna(-1) >= b2.fillna(-1), u.OCOP1.map(major), u.OCOP2.map(major))
occupation = {}
for g in [str(i) for i in range(10)]:
    m = u.occ == g
    occupation['isco' + g] = round(wmean(u.HISEI[m], u[W][m]), 1)
occupation['unknown'] = round(wmean(u.HISEI, u[W]), 1)

# ---------- 5. Речі вдома → HOMEPOS (лінійна модель на категоріях відповідей)
GROUPS = {
    'books': {'0-10': [1, 2], '11-25': [3], '26-100': [4], '101-200': [5], '200+': [6, 7]},
    'cars': {'0': [1], '1': [2], '2': [3], '3+': [4]},
    'toilets': {'0': [1], '1': [2], '2': [3], '3+': [4]},
    'laptops': {'0': [1], '1-2': [2], '3-5': [3], '5+': [4]},
    'tvs': {'0': [1], '1-2': [2], '3-5': [3], '5+': [4]},
}
h = u.dropna(subset=['HOMEPOS']).copy()
for q, var in HOME.items():
    h[q] = None
    for opt, codes in GROUPS[q].items():
        h.loc[h[var].isin(codes), q] = opt
h = h.dropna(subset=list(HOME))  # повні відповіді на всі п'ять питань
design, names = [np.ones(len(h))], ['intercept']
for q in HOME:
    for opt in list(GROUPS[q])[1:]:  # перша категорія — базова
        design.append((h[q] == opt).astype(float).values)
        names.append(f'{q}:{opt}')
coef = dict(zip(names, wls(np.column_stack(design), h.HOMEPOS.values, h[W].values)))
home = {'intercept': round(float(coef['intercept']), 4), 'items': {}}
for q in HOME:
    eff = {opt: (0.0 if i == 0 else round(float(coef[f'{q}:{opt}']), 4)) for i, opt in enumerate(GROUPS[q])}
    shares = h.groupby(q)[W].sum() / h[W].sum()
    eff['unknown'] = round(float(sum(eff[o] * shares.get(o, 0) for o in GROUPS[q])), 4)  # «Не знаю» = середній внесок
    home['items'][q] = eff

# ---------- 6. Перевірка: наскільки часто оцінка дає правильний рівень
def predict(df):
    pe = df.HISCED.map({c: education[k] for k, v in EDU.items() for c in v}).fillna(education['unknown'])
    hi = df.occ.map(lambda g: occupation.get('isco' + g) if isinstance(g, str) else None).astype(float).fillna(occupation['unknown'])
    hp = pd.Series(home['intercept'], index=df.index)
    for q, var in HOME.items():
        lookup = {c: home['items'][q][opt] for opt, codes in GROUPS[q].items() for c in codes}
        hp = hp + df[var].map(lookup).fillna(home['items'][q]['unknown'])
    return b0 + bP * pe + bI * hi + bH * hp

ev = u.dropna(subset=['ESCS']).copy()
ev['pred'] = predict(ev)
lvl = lambda x: np.select([x <= cuts[0], x <= cuts[1]], [0, 1], 2)
true, pred, w = lvl(ev.ESCS), lvl(ev.pred), ev[W]
accuracy = float(np.average(true == pred, weights=w))
off_by_two = float(np.average(np.abs(true - pred) == 2, weights=w))
r2 = float(1 - np.average((ev.ESCS - ev.pred) ** 2, weights=w) / np.average((ev.ESCS - np.average(ev.ESCS, weights=w)) ** 2, weights=w))
# точність поблизу межі рівнів (|оцінка − межа| < 0,2) і далеко від неї
near = np.minimum(abs(ev.pred - cuts[0]), abs(ev.pred - cuts[1])) < 0.2
acc_near = float(np.average((true == pred)[near], weights=w[near]))
acc_far = float(np.average((true == pred)[~near], weights=w[~near]))

out = dict(
    source='OECD PISA 2025 Student Questionnaire PUF, Ukraine (CNT QUA); scripts/escs_model.py',
    formula=dict(intercept=round(float(b0), 4), paredint=round(float(bP), 4), hisei=round(float(bI), 4), homepos=round(float(bH), 4)),
    cuts=[round(c, 4) for c in cuts], near_cut=0.2,
    education=education, occupation=occupation, home=home,
    validation=dict(accuracy=round(accuracy, 3), off_by_two=round(off_by_two, 4), r2=round(r2, 3),
                    accuracy_near_cut=round(acc_near, 3), accuracy_far_from_cut=round(acc_far, 3), share_near_cut=round(float(np.average(near, weights=w)), 3)),
)
json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1))
