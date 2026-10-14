"""PISA estimation helpers: weighted OLS with 10 plausible values (Rubin's rules)
and 80 BRR-Fay replicate weights (Fay factor 0.5 -> sampling variance = 4/80 * sum of squares)."""
import numpy as np, pandas as pd

RW = [f'W_FSTURWT{i}' for i in range(1, 81)]
SUBJECTS = ['MATH', 'READ', 'SCIE']


def pvs(subj):
    return [f'PV{i}{subj}' for i in range(1, 11)]


def _ycols(y):
    """y is a subject code ('MATH'), a single column name, or a list of columns (one per PV)."""
    if isinstance(y, list):
        return y
    return pvs(y) if y in SUBJECTS else [y]


def combine(theta0, reps):
    """theta0: (..., M) full-weight estimates per PV; reps: (80, ..., M). Returns estimate, SE."""
    M = theta0.shape[-1]
    samp = (0.05 * ((reps - theta0) ** 2).sum(0)).mean(-1)
    imp = theta0.var(-1, ddof=1) if M > 1 else 0.0
    return theta0.mean(-1), np.sqrt(samp + (1 + 1 / M) * imp)


def fit(df, xcols, y):
    """Returns dict with full-weight coefficients B0 (k x M), replicate coefficients (80 x k x M), data used."""
    yc = _ycols(y)
    d = df.dropna(subset=xcols + yc + ['W_FSTUWT'])
    X = np.column_stack([np.ones(len(d))] + [d[c].to_numpy(float) for c in xcols])
    Y = d[yc].to_numpy(float)

    def solve(w):
        XW = X * w[:, None]
        return np.linalg.solve(XW.T @ X, XW.T @ Y)

    w0 = d['W_FSTUWT'].to_numpy(float)
    B0 = solve(w0)
    reps = np.stack([solve(d[r].to_numpy(float)) for r in RW])
    res = Y - X @ B0
    ybar = (Y * w0[:, None]).sum(0) / w0.sum()
    r2 = (1 - (w0[:, None] * res ** 2).sum(0) / (w0[:, None] * (Y - ybar) ** 2).sum(0)).mean()
    return dict(names=['const'] + xcols, B0=B0, reps=reps, r2=r2, n=len(d), nsch=d.CNTSCHID.nunique(), data=d)


def table(f):
    b, se = combine(f['B0'], f['reps'])
    out = pd.DataFrame({'b': b, 'se': se}, index=f['names'])
    out['t'] = out.b / out.se
    return out


def wls(df, xcols, y):
    f = fit(df, xcols, y)
    return table(f), f['r2'], f['n'], f['nsch']


def coef_change(df, base, full, coef, y):
    """Change in `coef` when moving from `base` to `full` model, estimated on the same sample, with BRR/PV SE."""
    need = list(dict.fromkeys(base + full))
    d = df.dropna(subset=need)
    fa, fb = fit(d, base, y), fit(d, full, y)
    ia, ib = fa['names'].index(coef), fb['names'].index(coef)
    ea, sa = combine(fa['B0'][ia], fa['reps'][:, ia])
    eb, sb = combine(fb['B0'][ib], fb['reps'][:, ib])
    ed, sd = combine(fa['B0'][ia] - fb['B0'][ib], fa['reps'][:, ia] - fb['reps'][:, ib])
    return dict(base=ea, base_se=sa, full=eb, full_se=sb, drop=ed, drop_se=sd, share=ed / ea, n=len(d))
