# render_formulas_v3.py
# 用 Times New Roman 风格字体（STIX）重新渲染所有公式
# STIX 字体是 Times New Roman 的数学版，视觉效果完全一致

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import os

# ═══════ 关键：使用 STIX 字体集（Times New Roman 数学版）═══════
matplotlib.rcParams['mathtext.fontset'] = 'stix'
matplotlib.rcParams['font.family'] = 'STIXGeneral'

# ═══════ 配置 ═══════
BASE = "D:/WorkBuddy/03_images_final/miniprogram/pages"
DIRS = {
    'eit': os.path.join(BASE, 'eit', 'images', 'formula'),
    'method': os.path.join(BASE, 'method', 'images', 'formula'),
    'tools': os.path.join(BASE, 'tools', 'images', 'formula'),
}
for d in DIRS.values():
    os.makedirs(d, exist_ok=True)

COLOR_DARK = "#f5d99b"   # 暗色面板（EIT/方法论详情页）
COLOR_LIGHT = "#3a3530"  # 亮色页面（工具页）
DPI = 300
FONTSIZE = 24


def render(latex_str, output_path, color=COLOR_DARK, fontsize=FONTSIZE):
    fig = plt.figure(figsize=(0.1, 0.1), dpi=DPI)
    fig.patch.set_alpha(0)
    fig.text(0.5, 0.5, latex_str, fontsize=fontsize, color=color, ha='center', va='center')
    fig.canvas.draw()
    bbox = fig.get_tightbbox(fig.canvas.get_renderer())
    fig.set_size_inches(
        max(bbox.width + 0.4, 1.0),
        max(bbox.height + 0.25, 0.4)
    )
    fig.savefig(output_path, transparent=True, dpi=DPI, bbox_inches='tight', pad_inches=0.06)
    plt.close(fig)
    print(f"  OK {os.path.basename(output_path)}")


# ═══════ EIT 公式 ═══════
print("=== EIT 公式（STIX/Times字体）===")
EIT = {
    1: r'$S = E \times H; \quad P_r = \iint_A \mathbf{S} \cdot \hat{n} \, dA$',
    2: r'$A_e = \frac{\lambda^2 G}{4\pi}; \quad I = \sum_n \log_2(1+\gamma_n)$',
    3: r'$P_r = P_t G_t G_r \left(\frac{\lambda}{4\pi R}\right)^2; \quad C = \sum_i \log_2\left(1+\frac{P_i \sigma_i^2}{N_0}\right)$',
    4: r'$v_n = \int_S \mathbf{E}(\mathbf{r}) \cdot \mathbf{E}_n^*(\mathbf{r}) \, d\mathbf{r}$',
    5: r'$\mathbf{y} = H\mathbf{x} + \mathbf{n}; \quad H = R\,G\,T$',
    6: r'$r = \mathrm{rank}(H), \quad r \leq N$',
    7: r'$N \uparrow \;\not\Rightarrow\; \mathrm{rank}(H) \uparrow$',
    8: r'$\Delta x \leq \lambda / 2$',
    9: r'$H = \sum_\ell \alpha_\ell \, \mathbf{a}_r(\Omega_{r,\ell}) \, \mathbf{a}_t^H(\Omega_{t,\ell})$',
    10: r'$R \gg 2D^2/\lambda$',
    11: r'$\mathbf{E}(\mathbf{r}) = \int_S G(\mathbf{r},\mathbf{r}\,)\, \mathbf{J}(\mathbf{r}\,)\, d\mathbf{r}\,$',
}
for cid, latex in EIT.items():
    render(latex, os.path.join(DIRS['eit'], f"f_eit_{cid:02d}.png"), color=COLOR_DARK)

# ═══════ 方法论公式 ═══════
print("\n=== 方法论公式（STIX/Times字体）===")
METHOD = {
    'system': r'$y(t) = H\{x(t)\}$',
    'optimize': r'$\min/\max \; F(x), \quad \mathrm{s.t.} \;\; g_i(x) \leq 0, \;\; h_j(x) = 0$',
}
for key, latex in METHOD.items():
    render(latex, os.path.join(DIRS['method'], f"f_m_{key}.png"), color=COLOR_DARK)

# ═══════ 工具页公式 ═══════
print("\n=== 工具页公式（STIX/Times字体）===")
TOOLS = {
    'skin': r'$\delta = \sqrt{\frac{2\rho}{\omega\mu}} = \frac{1}{\sqrt{\pi f \mu \sigma}}$',
    'ae': r'$A_e = \frac{G \cdot \lambda^2}{4\pi}, \quad G_{lin} = 10^{G_{dBi}/10}$',
    'farfield': r'$R_{ff} = \frac{2D^2}{\lambda}, \quad R_{nf} \approx 0.62\sqrt{\frac{D^3}{\lambda}}$',
    'los': r'$d = \sqrt{2kR \cdot h_t} + \sqrt{2kR \cdot h_r}, \quad R = 6371 \;\mathrm{km}$',
    'noise': r'$P_n = kTB + NF, \quad \mathrm{Sens} = P_n + \mathrm{SNR}_{min}$',
}
for key, latex in TOOLS.items():
    render(latex, os.path.join(DIRS['tools'], f"f_tools_{key}.png"), color=COLOR_LIGHT)

print("\n=== 全部完成（STIX/Times New Roman 字体）===")
