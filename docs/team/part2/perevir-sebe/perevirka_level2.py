"""Рахує частку учнів на рівні 2+ (PISA 2025, Україна) за методом ОЕСР:
вага учня, 10 PV, 80 реплікаційних ваг BRR-Fay (k=0,5)."""
import sys, numpy as np, pandas as pd, pyreadstat
SAV = sys.argv[1]
CUT = {"read": 407.47, "math": 420.07, "scie": 409.54}   # межі рівня 2 з брифу
SUBJ = {"read": "READ", "math": "MATH", "scie": "SCIE"}
cols = ["ST004D01T", "ESCS", "W_FSTUWT"] + [f"W_FSTURWT{i}" for i in range(1, 81)] \
     + [f"PV{p}{s}" for p in range(1, 11) for s in SUBJ.values()]
df, meta = pyreadstat.read_sav(SAV, usecols=cols)
print("Мітки статі:", meta.variable_value_labels.get("ST004D01T"))
g = df["ST004D01T"].map({1: "female", 2: "male"})
e = pd.cut(df["ESCS"], [-np.inf, -0.68, 0.19, np.inf], labels=["low", "mid", "high"])
W = df[["W_FSTUWT"] + [f"W_FSTURWT{i}" for i in range(1, 81)]].to_numpy()

def est(mask, subj):
    w = W[mask]; vals, svar = [], []
    for p in range(1, 11):
        hit = (df.loc[mask, f"PV{p}{SUBJ[subj]}"].to_numpy() >= CUT[subj]).astype(float)
        th = (w * hit[:, None]).sum(0) / w.sum(0) * 100
        vals.append(th[0]); svar.append(((th[1:] - th[0]) ** 2).sum() / 20)  # 1/(80*0.25)
    vals = np.array(vals); est_ = vals.mean()
    se = np.sqrt(np.mean(svar) + (1 + 1/10) * vals.var(ddof=1))
    return est_, se, int(mask.sum())

rows = []
for s in CUT:
    for gg in ["female", "male", "all"]:
        for ee in ["low", "mid", "high", "all"]:
            m = np.ones(len(df), bool)
            if gg != "all": m &= (g == gg).to_numpy()
            if ee != "all": m &= (e == ee).to_numpy()
            p, se, n = est(m, s)
            rows.append(dict(subject=s, gender=gg, escs=ee, pct_level2=round(p, 1),
                             ci_low=round(p - 1.96*se, 1), ci_high=round(p + 1.96*se, 1), n_students=n))
out = pd.DataFrame(rows)
out.to_csv(sys.argv[2], index=False)
print(out.to_string())
