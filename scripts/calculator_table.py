"""Results table for the PISA Ukraine calculator (PISA 2025, Ukraine = CNT 'QUA').

For every subject x gender x ESCS group (plus 'all' margins): share of students at or above proficiency
Level 2, its 95% CI, mean score, number of students and schools, and the comparison with all of Ukraine.
Also: OECD average share at Level 2+, gaps between groups, share at Levels 5-6.
Estimation: final student weight + 80 BRR-Fay replicate weights, 10 plausible values (Rubin's rules).

Usage: python calculator_table.py <CY09_MS_STU_PUF.sav (full file)> <output dir>
The source data are only read, never modified.
"""
import sys, os, json
import numpy as np, pandas as pd, pyreadstat
from pisa import combine

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
SUBJ = {'read': 'READ', 'math': 'MATH', 'scie': 'SCIE'}
# Lower score limits of proficiency levels as used in PISA 2018/2022 reporting.
# Mathematics and reading reproduce the published Ukrainian figures; science must be checked for PISA 2025.
L2 = {'MATH': 420.07, 'READ': 407.47, 'SCIE': 409.54}
L5 = {'MATH': 606.99, 'READ': 625.61, 'SCIE': 633.33}
RW = [f'W_FSTURWT{i}' for i in range(1, 81)]
PV = [f'PV{i}{s}' for s in SUBJ.values() for i in range(1, 11)]
cols = ['CNT', 'CNTSCHID', 'OECD', 'ST004D01T', 'ESCS', 'ISCEDP', 'W_FSTUWT'] + RW + PV
d, _ = pyreadstat.read_sav(SRC, usecols=cols, apply_value_formats=False)  # user-missing codes -> NaN

def weights(x):
    return np.column_stack([x.W_FSTUWT.to_numpy()] + [x[r].to_numpy() for r in RW])  # n x 81

def theta_share(x, subj, cut):
    W, Y = weights(x), x[[f'PV{i}{subj}' for i in range(1, 11)]].to_numpy()
    return (W.T @ (Y >= cut).astype(float)) / W.sum(0)[:, None]  # 81 x 10

def theta_mean(x, subj):
    W, Y = weights(x), x[[f'PV{i}{subj}' for i in range(1, 11)]].to_numpy()
    return (W.T @ Y) / W.sum(0)[:, None]

def est(th):
    e, se = combine(th[0], th[1:])
    return float(e), float(se)

# ---------- Ukraine
u = d[d.CNT == 'QUA'].reset_index(drop=True)
e = u.dropna(subset=['ESCS'])
order = e.ESCS.sort_values().index
cw = e.W_FSTUWT[order].cumsum() / e.W_FSTUWT.sum()
u['escs'] = None
u.loc[order, 'escs'] = np.select([cw <= 1 / 3, cw <= 2 / 3], ['low', 'mid'], 'high')
cuts = [round(float(e.ESCS[order][cw <= q].iloc[-1]), 2) for q in (1 / 3, 2 / 3)]
u['gender'] = u.ST004D01T.map({1: 'female', 2: 'male'})
# Тип навчання («Де ти вчишся?») за ISCEDP: 244 — 9 клас; 344 — 10–11 клас, загальна освіта;
# 354 — професійна освіта (ПТУ, фахові коледжі, коледжі у складі ЗВО).
TRACKS = {244: 'grade9', 344: 'general', 354: 'vocational'}
u['track'] = u.ISCEDP.map(TRACKS)

def subset(g, s, t='all'):
    x = u
    if g != 'all': x = x[x.gender == g]
    if s != 'all': x = x[x.escs == s]
    if t != 'all': x = x[x.track == t]
    return x

def make_row(key, subj, th_all, g, s, t):
    x = subset(g, s, t)
    th = theta_share(x, subj, L2[subj])
    p, pse = est(th)
    m, mse = est(theta_mean(x, subj))
    diff, dse = est(th - th_all)  # завжди порівняння з усіма учнями України
    n, ns = len(x), x.CNTSCHID.nunique()
    enough = n >= 30 and ns >= 5  # PISA reporting standard
    sig = abs(diff) > 1.96 * dse if dse > 0 else False
    return dict(subject=key, gender=g, escs=s, track=t,
                pct_level2=round(100 * p, 1), ci_low=round(100 * (p - 1.96 * pse), 1), ci_high=round(100 * (p + 1.96 * pse), 1),
                se=round(100 * pse, 2), mean_score=round(m, 1), mean_se=round(mse, 1),
                diff_vs_ukraine=round(100 * diff, 1), diff_se=round(100 * dse, 2),
                vs_ukraine=('about' if (g == 'all' and s == 'all' and t == 'all') else ('above' if sig and diff > 0 else 'below' if sig else 'about')),
                n_students=n, n_schools=ns, enough_data=enough)

rows = []
for key, subj in SUBJ.items():
    th_all = theta_share(u, subj, L2[subj])
    for g in ['all', 'female', 'male']:
        for s in ['all', 'low', 'mid', 'high']:
            rows.append(make_row(key, subj, th_all, g, s, 'all'))
    for t in TRACKS.values():
        for g in ['female', 'male']:
            for s in ['low', 'mid', 'high']:
                rows.append(make_row(key, subj, th_all, g, s, t))
table = pd.DataFrame(rows)

# ---------- OECD average (mean of OECD country estimates; SE = sqrt(sum SE^2) / N)
oecd = {}
oecd_cnts = sorted(d[d.OECD == 1].CNT.unique())
for key, subj in SUBJ.items():
    ests = [est(theta_share(d[d.CNT == c], subj, L2[subj])) for c in oecd_cnts]
    oecd[key] = dict(pct_level2=round(100 * np.mean([a for a, _ in ests]), 1),
                     se=round(100 * np.sqrt(sum(b ** 2 for _, b in ests)) / len(ests), 2))

# ---------- Gaps (score points and percentage points) and top performers
gaps = {}
for key, subj in SUBJ.items():
    f, m_ = u[u.gender == 'female'], u[u.gender == 'male']
    lo, hi = u[u.escs == 'low'], u[u.escs == 'high']
    gaps[key] = {
        'female_minus_male_points': est(theta_mean(f, subj) - theta_mean(m_, subj)),
        'high_minus_low_escs_points': est(theta_mean(hi, subj) - theta_mean(lo, subj)),
        'female_minus_male_pp_level2': est(100 * (theta_share(f, subj, L2[subj]) - theta_share(m_, subj, L2[subj]))),
        'high_minus_low_escs_pp_level2': est(100 * (theta_share(hi, subj, L2[subj]) - theta_share(lo, subj, L2[subj]))),
        'share_level5plus_pct': est(100 * theta_share(u, subj, L5[subj])),
    }
    gaps[key] = {k: dict(estimate=round(v[0], 1), se=round(v[1], 2)) for k, v in gaps[key].items()}

meta = dict(
    source='OECD PISA 2025 Student Questionnaire public use file (CY09_MS_STU_PUF), Ukraine = CNT QUA ("Ukrainian regions, 17 of 27")',
    students=int(len(u)), schools=int(u.CNTSCHID.nunique()), escs_missing=int(u.ESCS.isna().sum()),
    tracks='track: grade9 = ISCEDP 244 (9 клас), general = 344 (10–11 клас, загальна освіта), vocational = 354 (професійна освіта: ПТУ, коледжі); all = без цієї ознаки.',
    escs_groups=f'Weighted national thirds of ESCS: low <= {cuts[0]}, mid ({cuts[0]}, {cuts[1]}], high > {cuts[1]}. Students with missing ESCS appear only in escs="all" rows.',
    level2_cutoffs=L2, level5_cutoffs=L5,
    cutoff_note='Level 2 cut-offs for mathematics and reading reproduce the published Ukrainian results; the science cut-off (PISA 2015-2022 scale) and all Level 5 cut-offs must be checked against the PISA 2025 Technical Report.',
    method='Final student weight W_FSTUWT; standard errors from 80 BRR-Fay replicate weights (factor 0.5) and 10 plausible values (Rubin). CI = estimate +/- 1.96 SE.',
    enough_data_rule='At least 30 students and 5 schools in the group (PISA reporting standard).',
    vs_ukraine_rule='"above"/"below" when the difference from all Ukrainian students is statistically significant (|diff| > 1.96 SE); otherwise "about".',
    oecd_average=f'Simple mean of {len(oecd_cnts)} OECD countries: {", ".join(oecd_cnts)}',
)
out = dict(meta=meta, groups=table.to_dict('records'), oecd_average=oecd, gaps=gaps)
json.dump(out, open(f'{OUT}/pisa_ukraine_calculator.json', 'w'), ensure_ascii=False, indent=1)
table.to_csv(f'{OUT}/pisa_ukraine_calculator.csv', index=False)
print(json.dumps(meta, ensure_ascii=False, indent=1))
print(table.to_string())
print(json.dumps(oecd), json.dumps(gaps, indent=1))
