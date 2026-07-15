# render_formulas.py
# 用 matplotlib mathtext (LaTeX引擎) 把公式渲染成高质量透明背景 WebP 图片
# 输出: miniprogram/pages/eit/images/formula/ 和 miniprogram/pages/method/images/formula/

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import os

# ═══════ 配置 ═══════
OUT_DIR_EIT = "D:/WorkBuddy/03_images_final/miniprogram/pages/eit/images/formula"
OUT_DIR_METHOD = "D:/WorkBuddy/03_images_final/miniprogram/pages/method/images/formula"
os.makedirs(OUT_DIR_EIT, exist_ok=True)
os.makedirs(OUT_DIR_METHOD, exist_ok=True)

# 公式颜色：暖金色，配合暗色面板
FORMULA_COLOR = "#f5d99b"
# DPI：200 足够清晰，又不会文件太大
DPI = 200

# ═══════ 公式定义 ═══════
# 每个公式用 LaTeX 语法，matplotlib mathtext 支持
EIT_FORMULAS = {
    1: r'$S = E \times H; \quad P_r = \iint_A \mathbf{S} \cdot \hat{n} \, dA$',
    2: r'$A_e = \frac{\lambda^2 G}{4\pi}; \quad I = \sum_n \log_2(1+\gamma_n)$',
    3: r'$P_r = P_t G_t G_r \left(\frac{\lambda}{4\pi R}\right)^2; \quad C = \sum_i \log_2\left(1+\frac{P_i \sigma_i^2}{N_0}\right)$',
    4: r'$v_n = \int_S \mathbf{E}(\mathbf{r}) \cdot \mathbf{E}_n^*(\mathbf{r}) \, d\mathbf{r}$',
    5: r'$\mathbf{y} = H\mathbf{x} + \mathbf{n}; \quad H = R\,G\,T; \quad \mathbf{y} = R\,G\,T\,\mathbf{x} + \mathbf{n}$',
    6: r'$r = \mathrm{rank}(H), \quad r \leq N$',
    7: r'$N \uparrow \;\not\Rightarrow\; \mathrm{rank}(H) \uparrow$',
    8: r'$\Delta x \leq \lambda / 2$',
    9: r'$H = \sum_\ell \alpha_\ell \, \mathbf{a}_r(\Omega_{r,\ell}) \, \mathbf{a}_t^H(\Omega_{t,\ell})$',
    10: r'$R \gg 2D^2/\lambda$',
    11: r'$\mathbf{E}(\mathbf{r}) = \int_S G(\mathbf{r},\mathbf{r}\,)\, \mathbf{J}(\mathbf{r}\,)\, d\mathbf{r}\,$',
    # 12 是概念流程图，不是公式，跳过
}

METHOD_FORMULAS = {
    # 卡片1: y(t) = H{x(t)}
    'm1_system': r'$y(t) = H\{x(t)\}$',
    # 卡片4: 优化通用形式
    'm4_optimize': r'$\min/\max \; F(x), \quad \mathrm{s.t.} \;\; g_i(x) \leq 0, \;\; h_j(x) = 0$',
}


def render_formula(latex_str, output_path, fontsize=20, color=FORMULA_COLOR):
    """渲染单个公式为透明背景 PNG"""
    fig = plt.figure(figsize=(0.1, 0.1), dpi=DPI)
    fig.patch.set_alpha(0)  # 透明背景

    # 用 text 渲染公式
    fig.text(
        0.5, 0.5,
        latex_str,
        fontsize=fontsize,
        color=color,
        ha='center', va='center',
    )

    # 紧凑布局：根据公式内容自动调整大小
    fig.canvas.draw()
    bbox = fig.get_tightbbox(fig.canvas.get_renderer())
    fig.set_size_inches(
        max(bbox.width + 0.3, 1.5),
        max(bbox.height + 0.2, 0.5)
    )

    fig.savefig(
        output_path,
        transparent=True,
        dpi=DPI,
        bbox_inches='tight',
        pad_inches=0.08,
    )
    plt.close(fig)
    print(f"  OK {output_path}")


# ═══════ 渲染 EIT 公式 ═══════
print("=== 渲染 EIT 公式 ===")
for card_id, latex in EIT_FORMULAS.items():
    # card 3 的公式很长，用稍小的字号
    fs = 18 if card_id in [3, 5, 9, 11] else 22
    output = os.path.join(OUT_DIR_EIT, f"f_eit_{card_id:02d}.png")
    render_formula(latex, output, fontsize=fs)

# ═══════ 渲染 Method 公式 ═══════
print("\n=== 渲染 Method 公式 ===")
for key, latex in METHOD_FORMULAS.items():
    output = os.path.join(OUT_DIR_METHOD, f"f_{key}.png")
    render_formula(latex, output, fontsize=22)

print("\n=== 全部渲染完成 ===")
print(f"EIT: {OUT_DIR_EIT}")
print(f"Method: {OUT_DIR_METHOD}")
