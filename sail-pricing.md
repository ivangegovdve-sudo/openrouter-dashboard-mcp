> ## Documentation Index
> Fetch the complete documentation index at: https://docs.sailresearch.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Pricing

> Usage-based inference & Sailbox prices, and Sail pricing plans

<div className="pricing-skip" role="navigation" aria-label="Skip to pricing section">
  <span className="pricing-skip-label">Skip to</span>
  <a href="#inference">Inference Pricing</a>
  <a href="#sailbox">Sailbox Pricing</a>
  <a href="#pricing-plans">Pricing Plans</a>
</div>

## Inference

Per-token Sail API pricing

### Core models

<div className="pricing-table-page">
  <div className="pricing-header">
    <span className="pricing-unit-callout" aria-label="Prices in US dollars per 1 million tokens">
      <span className="pricing-unit-currency">USD</span>

      <span className="pricing-unit-sep" aria-hidden="true">
        ·
      </span>

      <span className="pricing-unit-rate">
        per <span className="pricing-unit-num">1M</span> tokens
      </span>
    </span>
  </div>

  <div className="pricing-table-wrapper">
    <table className="pricing-table">
      <thead>
        <tr className="pricing-header-row">
          <th className="pricing-th pricing-th-model" style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            Model
          </th>

          <th className="pricing-th pricing-th-window" style={{ width: "8.5rem", minWidth: "8.5rem" }}>
            <a className="cap-th-link" href="/completion-windows">
              Window
            </a>
          </th>

          <th className="pricing-th pricing-th-axis" style={{ width: "9.0rem" }}>
            Input
          </th>

          <th className="pricing-th pricing-th-axis" style={{ width: "9.0rem" }}>
            Cached
          </th>

          <th className="pricing-th pricing-th-axis" style={{ width: "9.0rem" }}>
            Output
          </th>
        </tr>
      </thead>

      <tbody className="pricing-model-group" data-model="moonshotai/Kimi-K3">
        <tr className="pricing-row pricing-row-window pricing-row-model-first" aria-label="Kimi K3 Default (ASAP) pricing: input $2.50, cached $0.25, output $12.50 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" rowSpan={3} style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            <div className="pricing-cell-model-inner">
              <span className="cap-logo" data-org="moonshot" role="img" aria-label="Moonshot AI" />

              <div className="pricing-model-meta">
                <div className="cap-model-name">Kimi K3</div>

                <div className="cap-slug-actions">
                  <span className="cap-slug-text" title="moonshotai/Kimi-K3">
                    <code>moonshotai/Kimi-K3</code>
                  </span>

                  <button
                    type="button"
                    className="cap-copy-btn"
                    aria-label="Copy moonshotai/Kimi-K3"
                    onClick={(e) => {
                  const b = e.currentTarget;
                  const t = "moonshotai/Kimi-K3";
                  const ok = () => {
                    b.classList.add("cap-copy-done");
                    setTimeout(
                      () => b.classList.remove("cap-copy-done"),
                      1500,
                    );
                  };
                  if (
                    navigator.clipboard &&
                    navigator.clipboard.writeText
                  ) {
                    navigator.clipboard
                      .writeText(t)
                      .then(ok)
                      .catch(() => fallback(b, t, ok));
                  } else {
                    fallback(b, t, ok);
                  }
                  function fallback(_b, _t, _ok) {
                    const ta = document.createElement("textarea");
                    ta.value = _t;
                    ta.style.position = "absolute";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                      document.execCommand("copy");
                      _ok();
                    } catch (_) {
                      _ok();
                    }
                    document.body.removeChild(ta);
                  }
                }}
                  >
                    <span className="cap-copy-icon-wrap">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-default" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />

                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>

                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-done" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </td>

          <td className="pricing-cell pricing-cell-window" data-window="asap">
            <span className="price-window-label">
              Default <span className="price-window-suffix">(ASAP)</span>
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              2.50
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.25
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              12.50
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window" aria-label="Kimi K3 Balanced pricing: input $2.00, cached $0.20, output $10.00 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="standard">
            <span className="price-window-label">Balanced</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              2.00
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.20
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              10.00
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window pricing-row-model-last" aria-label="Kimi K3 Flex pricing: input $1.25, cached $0.15, output $6.25 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="flex">
            <span className="price-window-label">Flex</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              1.25
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.15
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              6.25
            </span>
          </td>
        </tr>
      </tbody>

      <tbody className="pricing-model-group" data-model="zai-org/GLM-5.3">
        <tr className="pricing-row pricing-row-window pricing-row-model-first" aria-label="GLM-5.3 Default (ASAP) pricing: input $0.98, cached $0.18, output $3.08 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" rowSpan={3} style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            <div className="pricing-cell-model-inner">
              <span className="cap-logo" data-org="zhipu" role="img" aria-label="Z.ai" />

              <div className="pricing-model-meta">
                <div className="cap-model-name">GLM-5.3</div>

                <div className="cap-slug-actions">
                  <span className="cap-slug-text" title="zai-org/GLM-5.3">
                    <code>zai-org/GLM-5.3</code>
                  </span>

                  <button
                    type="button"
                    className="cap-copy-btn"
                    aria-label="Copy zai-org/GLM-5.3"
                    onClick={(e) => {
                  const b = e.currentTarget;
                  const t = "zai-org/GLM-5.3";
                  const ok = () => {
                    b.classList.add("cap-copy-done");
                    setTimeout(
                      () => b.classList.remove("cap-copy-done"),
                      1500,
                    );
                  };
                  if (
                    navigator.clipboard &&
                    navigator.clipboard.writeText
                  ) {
                    navigator.clipboard
                      .writeText(t)
                      .then(ok)
                      .catch(() => fallback(b, t, ok));
                  } else {
                    fallback(b, t, ok);
                  }
                  function fallback(_b, _t, _ok) {
                    const ta = document.createElement("textarea");
                    ta.value = _t;
                    ta.style.position = "absolute";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                      document.execCommand("copy");
                      _ok();
                    } catch (_) {
                      _ok();
                    }
                    document.body.removeChild(ta);
                  }
                }}
                  >
                    <span className="cap-copy-icon-wrap">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-default" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />

                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>

                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-done" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </td>

          <td className="pricing-cell pricing-cell-window" data-window="asap">
            <span className="price-window-label">
              Default <span className="price-window-suffix">(ASAP)</span>
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.98
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.18
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              3.08
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window" aria-label="GLM-5.3 Balanced pricing: input $0.50, cached $0.12, output $2.50 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="standard">
            <span className="price-window-label">Balanced</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.50
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.12
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              2.50
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window pricing-row-model-last" aria-label="GLM-5.3 Flex pricing: input $0.40, cached $0.08, output $1.80 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="flex">
            <span className="price-window-label">Flex</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.40
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.08
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              1.80
            </span>
          </td>
        </tr>
      </tbody>

      <tbody className="pricing-model-group" data-model="zai-org/GLM-5.3-Flash">
        <tr className="pricing-row pricing-row-window pricing-row-model-first" aria-label="GLM-5.3-Flash Default (ASAP) pricing: input $0.11, cached $0.02, output $0.35 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" rowSpan={3} style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            <div className="pricing-cell-model-inner">
              <span className="cap-logo" data-org="zhipu" role="img" aria-label="Z.ai" />

              <div className="pricing-model-meta">
                <div className="cap-model-name">GLM-5.3-Flash</div>

                <div className="cap-slug-actions">
                  <span className="cap-slug-text" title="zai-org/GLM-5.3-Flash">
                    <code>zai-org/GLM-5.3-Flash</code>
                  </span>

                  <button
                    type="button"
                    className="cap-copy-btn"
                    aria-label="Copy zai-org/GLM-5.3-Flash"
                    onClick={(e) => {
                  const b = e.currentTarget;
                  const t = "zai-org/GLM-5.3-Flash";
                  const ok = () => {
                    b.classList.add("cap-copy-done");
                    setTimeout(
                      () => b.classList.remove("cap-copy-done"),
                      1500,
                    );
                  };
                  if (
                    navigator.clipboard &&
                    navigator.clipboard.writeText
                  ) {
                    navigator.clipboard
                      .writeText(t)
                      .then(ok)
                      .catch(() => fallback(b, t, ok));
                  } else {
                    fallback(b, t, ok);
                  }
                  function fallback(_b, _t, _ok) {
                    const ta = document.createElement("textarea");
                    ta.value = _t;
                    ta.style.position = "absolute";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                      document.execCommand("copy");
                      _ok();
                    } catch (_) {
                      _ok();
                    }
                    document.body.removeChild(ta);
                  }
                }}
                  >
                    <span className="cap-copy-icon-wrap">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-default" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />

                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>

                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-done" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </td>

          <td className="pricing-cell pricing-cell-window" data-window="asap">
            <span className="price-window-label">
              Default <span className="price-window-suffix">(ASAP)</span>
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.11
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.02
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.35
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window" aria-label="GLM-5.3-Flash Balanced pricing: input $0.08, cached $0.02, output $0.28 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="standard">
            <span className="price-window-label">Balanced</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.08
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.02
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.28
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window pricing-row-model-last" aria-label="GLM-5.3-Flash Flex pricing: input $0.05, cached $0.01, output $0.18 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="flex">
            <span className="price-window-label">Flex</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.05
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.01
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.18
            </span>
          </td>
        </tr>
      </tbody>

      <tbody className="pricing-model-group" data-model="deepseek-ai/DeepSeek-V4.1-Flash">
        <tr className="pricing-row pricing-row-window pricing-row-model-first" aria-label="DeepSeek V4.1 Flash Default (ASAP) pricing: input $0.15, cached $0.006, output $0.60 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" rowSpan={3} style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            <div className="pricing-cell-model-inner">
              <span className="cap-logo" data-org="deepseek" role="img" aria-label="DeepSeek" />

              <div className="pricing-model-meta">
                <div className="cap-model-name">DeepSeek V4.1 Flash</div>

                <div className="cap-slug-actions">
                  <span className="cap-slug-text" title="deepseek-ai/DeepSeek-V4.1-Flash">
                    <code>deepseek-ai/DeepSeek-V4.1-Flash</code>
                  </span>

                  <button
                    type="button"
                    className="cap-copy-btn"
                    aria-label="Copy deepseek-ai/DeepSeek-V4.1-Flash"
                    onClick={(e) => {
                  const b = e.currentTarget;
                  const t = "deepseek-ai/DeepSeek-V4.1-Flash";
                  const ok = () => {
                    b.classList.add("cap-copy-done");
                    setTimeout(
                      () => b.classList.remove("cap-copy-done"),
                      1500,
                    );
                  };
                  if (
                    navigator.clipboard &&
                    navigator.clipboard.writeText
                  ) {
                    navigator.clipboard
                      .writeText(t)
                      .then(ok)
                      .catch(() => fallback(b, t, ok));
                  } else {
                    fallback(b, t, ok);
                  }
                  function fallback(_b, _t, _ok) {
                    const ta = document.createElement("textarea");
                    ta.value = _t;
                    ta.style.position = "absolute";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                      document.execCommand("copy");
                      _ok();
                    } catch (_) {
                      _ok();
                    }
                    document.body.removeChild(ta);
                  }
                }}
                  >
                    <span className="cap-copy-icon-wrap">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-default" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />

                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>

                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-done" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </td>

          <td className="pricing-cell pricing-cell-window" data-window="asap">
            <span className="price-window-label">
              Default <span className="price-window-suffix">(ASAP)</span>
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.15
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.006
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.60
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window" aria-label="DeepSeek V4.1 Flash Balanced pricing: input $0.12, cached $0.005, output $0.48 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="standard">
            <span className="price-window-label">Balanced</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.12
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.005
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.48
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window pricing-row-model-last" aria-label="DeepSeek V4.1 Flash Flex pricing: input $0.08, cached $0.004, output $0.30 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="flex">
            <span className="price-window-label">Flex</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.08
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.004
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.30
            </span>
          </td>
        </tr>
      </tbody>

      <tbody className="pricing-model-group" data-model="deepseek-ai/DeepSeek-V4-Pro-0813">
        <tr className="pricing-row pricing-row-window pricing-row-model-first" aria-label="DeepSeek V4 Pro 0813 Default (ASAP) pricing: input $0.92, cached $0.04, output $2.77 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" rowSpan={3} style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            <div className="pricing-cell-model-inner">
              <span className="cap-logo" data-org="deepseek" role="img" aria-label="DeepSeek" />

              <div className="pricing-model-meta">
                <div className="cap-model-name">DeepSeek V4 Pro 0813</div>

                <div className="cap-slug-actions">
                  <span className="cap-slug-text" title="deepseek-ai/DeepSeek-V4-Pro-0813">
                    <code>deepseek-ai/DeepSeek-V4-Pro-0813</code>
                  </span>

                  <button
                    type="button"
                    className="cap-copy-btn"
                    aria-label="Copy deepseek-ai/DeepSeek-V4-Pro-0813"
                    onClick={(e) => {
                  const b = e.currentTarget;
                  const t = "deepseek-ai/DeepSeek-V4-Pro-0813";
                  const ok = () => {
                    b.classList.add("cap-copy-done");
                    setTimeout(
                      () => b.classList.remove("cap-copy-done"),
                      1500,
                    );
                  };
                  if (
                    navigator.clipboard &&
                    navigator.clipboard.writeText
                  ) {
                    navigator.clipboard
                      .writeText(t)
                      .then(ok)
                      .catch(() => fallback(b, t, ok));
                  } else {
                    fallback(b, t, ok);
                  }
                  function fallback(_b, _t, _ok) {
                    const ta = document.createElement("textarea");
                    ta.value = _t;
                    ta.style.position = "absolute";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                      document.execCommand("copy");
                      _ok();
                    } catch (_) {
                      _ok();
                    }
                    document.body.removeChild(ta);
                  }
                }}
                  >
                    <span className="cap-copy-icon-wrap">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-default" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />

                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>

                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-done" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </td>

          <td className="pricing-cell pricing-cell-window" data-window="asap">
            <span className="price-window-label">
              Default <span className="price-window-suffix">(ASAP)</span>
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.92
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.04
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              2.77
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window" aria-label="DeepSeek V4 Pro 0813 Balanced pricing: input $0.74, cached $0.03, output $2.22 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="standard">
            <span className="price-window-label">Balanced</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.74
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.03
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              2.22
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window pricing-row-model-last" aria-label="DeepSeek V4 Pro 0813 Flex pricing: input $0.46, cached $0.02, output $1.39 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="flex">
            <span className="price-window-label">Flex</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.46
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.02
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              1.39
            </span>
          </td>
        </tr>
      </tbody>

      <tbody className="pricing-model-group" data-model="deepseek-ai/DeepSeek-V4-Flash-0731">
        <tr className="pricing-row pricing-row-window pricing-row-model-first" aria-label="DeepSeek V4 Flash 0731 Default (ASAP) pricing: input $0.09, cached $0.02, output $0.18 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" rowSpan={3} style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            <div className="pricing-cell-model-inner">
              <span className="cap-logo" data-org="deepseek" role="img" aria-label="DeepSeek" />

              <div className="pricing-model-meta">
                <div className="cap-model-name">DeepSeek V4 Flash 0731</div>

                <div className="cap-slug-actions">
                  <span className="cap-slug-text" title="deepseek-ai/DeepSeek-V4-Flash-0731">
                    <code>deepseek-ai/DeepSeek-V4-Flash-0731</code>
                  </span>

                  <button
                    type="button"
                    className="cap-copy-btn"
                    aria-label="Copy deepseek-ai/DeepSeek-V4-Flash-0731"
                    onClick={(e) => {
                  const b = e.currentTarget;
                  const t = "deepseek-ai/DeepSeek-V4-Flash-0731";
                  const ok = () => {
                    b.classList.add("cap-copy-done");
                    setTimeout(
                      () => b.classList.remove("cap-copy-done"),
                      1500,
                    );
                  };
                  if (
                    navigator.clipboard &&
                    navigator.clipboard.writeText
                  ) {
                    navigator.clipboard
                      .writeText(t)
                      .then(ok)
                      .catch(() => fallback(b, t, ok));
                  } else {
                    fallback(b, t, ok);
                  }
                  function fallback(_b, _t, _ok) {
                    const ta = document.createElement("textarea");
                    ta.value = _t;
                    ta.style.position = "absolute";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                      document.execCommand("copy");
                      _ok();
                    } catch (_) {
                      _ok();
                    }
                    document.body.removeChild(ta);
                  }
                }}
                  >
                    <span className="cap-copy-icon-wrap">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-default" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />

                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>

                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-done" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </td>

          <td className="pricing-cell pricing-cell-window" data-window="asap">
            <span className="price-window-label">
              Default <span className="price-window-suffix">(ASAP)</span>
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.09
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.02
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.18
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window" aria-label="DeepSeek V4 Flash 0731 Balanced pricing: input $0.07, cached $0.02, output $0.14 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="standard">
            <span className="price-window-label">Balanced</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.07
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.02
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.14
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window pricing-row-model-last" aria-label="DeepSeek V4 Flash 0731 Flex pricing: input $0.05, cached $0.01, output $0.09 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="flex">
            <span className="price-window-label">Flex</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.05
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.01
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.09
            </span>
          </td>
        </tr>
      </tbody>

      <tbody className="pricing-model-group" data-model="moonshotai/Kimi-K2.6">
        <tr className="pricing-row pricing-row-window pricing-row-model-first" aria-label="Kimi-K2.6 Default (ASAP) pricing: input $1.00, cached $0.20, output $4.00 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" rowSpan={3} style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            <div className="pricing-cell-model-inner">
              <span className="cap-logo" data-org="moonshot" role="img" aria-label="Moonshot AI" />

              <div className="pricing-model-meta">
                <div className="cap-model-name">Kimi-K2.6</div>

                <div className="cap-slug-actions">
                  <span className="cap-slug-text" title="moonshotai/Kimi-K2.6">
                    <code>moonshotai/Kimi-K2.6</code>
                  </span>

                  <button
                    type="button"
                    className="cap-copy-btn"
                    aria-label="Copy moonshotai/Kimi-K2.6"
                    onClick={(e) => {
                  const b = e.currentTarget;
                  const t = "moonshotai/Kimi-K2.6";
                  const ok = () => {
                    b.classList.add("cap-copy-done");
                    setTimeout(
                      () => b.classList.remove("cap-copy-done"),
                      1500,
                    );
                  };
                  if (
                    navigator.clipboard &&
                    navigator.clipboard.writeText
                  ) {
                    navigator.clipboard
                      .writeText(t)
                      .then(ok)
                      .catch(() => fallback(b, t, ok));
                  } else {
                    fallback(b, t, ok);
                  }
                  function fallback(_b, _t, _ok) {
                    const ta = document.createElement("textarea");
                    ta.value = _t;
                    ta.style.position = "absolute";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                      document.execCommand("copy");
                      _ok();
                    } catch (_) {
                      _ok();
                    }
                    document.body.removeChild(ta);
                  }
                }}
                  >
                    <span className="cap-copy-icon-wrap">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-default" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />

                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>

                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-done" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </td>

          <td className="pricing-cell pricing-cell-window" data-window="asap">
            <span className="price-window-label">
              Default <span className="price-window-suffix">(ASAP)</span>
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              1.00
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.20
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              4.00
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window" aria-label="Kimi-K2.6 Balanced pricing: input $0.45, cached $0.20, output $3.00 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="standard">
            <span className="price-window-label">Balanced</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.45
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.20
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              3.00
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window pricing-row-model-last" aria-label="Kimi-K2.6 Flex pricing: input $0.35, cached $0.10, output $2.00 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="flex">
            <span className="price-window-label">Flex</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.35
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.10
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              2.00
            </span>
          </td>
        </tr>
      </tbody>

      <tbody className="pricing-model-group" data-model="google/gemma-4-31B-it">
        <tr className="pricing-row pricing-row-window pricing-row-model-first" aria-label="Gemma 4 31B IT Default (ASAP) pricing: input $0.40, cached $0.20, output $0.60 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" rowSpan={3} style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            <div className="pricing-cell-model-inner">
              <span className="cap-logo" data-org="gemma" role="img" aria-label="Google" />

              <div className="pricing-model-meta">
                <div className="cap-model-name">Gemma 4 31B IT</div>

                <div className="cap-slug-actions">
                  <span className="cap-slug-text" title="google/gemma-4-31B-it">
                    <code>google/gemma-4-31B-it</code>
                  </span>

                  <button
                    type="button"
                    className="cap-copy-btn"
                    aria-label="Copy google/gemma-4-31B-it"
                    onClick={(e) => {
                  const b = e.currentTarget;
                  const t = "google/gemma-4-31B-it";
                  const ok = () => {
                    b.classList.add("cap-copy-done");
                    setTimeout(
                      () => b.classList.remove("cap-copy-done"),
                      1500,
                    );
                  };
                  if (
                    navigator.clipboard &&
                    navigator.clipboard.writeText
                  ) {
                    navigator.clipboard
                      .writeText(t)
                      .then(ok)
                      .catch(() => fallback(b, t, ok));
                  } else {
                    fallback(b, t, ok);
                  }
                  function fallback(_b, _t, _ok) {
                    const ta = document.createElement("textarea");
                    ta.value = _t;
                    ta.style.position = "absolute";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                      document.execCommand("copy");
                      _ok();
                    } catch (_) {
                      _ok();
                    }
                    document.body.removeChild(ta);
                  }
                }}
                  >
                    <span className="cap-copy-icon-wrap">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-default" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />

                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>

                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-done" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </td>

          <td className="pricing-cell pricing-cell-window" data-window="asap">
            <span className="price-window-label">
              Default <span className="price-window-suffix">(ASAP)</span>
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.40
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.20
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.60
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window" aria-label="Gemma 4 31B IT Balanced pricing: input $0.12, cached $0.08, output $0.60 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="standard">
            <span className="price-window-label">Balanced</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.12
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.08
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.60
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window pricing-row-model-last" aria-label="Gemma 4 31B IT Flex pricing: input $0.06, cached $0.02, output $0.30 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="flex">
            <span className="price-window-label">Flex</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.06
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.02
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.30
            </span>
          </td>
        </tr>
      </tbody>

      <tbody className="pricing-model-group" data-model="nvidia/Gemma-4-31B-IT-NVFP4">
        <tr className="pricing-row pricing-row-window pricing-row-model-first" aria-label="Gemma 4 31B IT (NVFP4) Default (ASAP) pricing: input $0.14, cached $0.07, output $0.40 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" rowSpan={3} style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            <div className="pricing-cell-model-inner">
              <span className="cap-logo" data-org="gemma" role="img" aria-label="Google" />

              <div className="pricing-model-meta">
                <div className="cap-model-name">Gemma 4 31B IT (NVFP4)</div>

                <div className="cap-slug-actions">
                  <span className="cap-slug-text" title="nvidia/Gemma-4-31B-IT-NVFP4">
                    <code>nvidia/Gemma-4-31B-IT-NVFP4</code>
                  </span>

                  <button
                    type="button"
                    className="cap-copy-btn"
                    aria-label="Copy nvidia/Gemma-4-31B-IT-NVFP4"
                    onClick={(e) => {
                  const b = e.currentTarget;
                  const t = "nvidia/Gemma-4-31B-IT-NVFP4";
                  const ok = () => {
                    b.classList.add("cap-copy-done");
                    setTimeout(
                      () => b.classList.remove("cap-copy-done"),
                      1500,
                    );
                  };
                  if (
                    navigator.clipboard &&
                    navigator.clipboard.writeText
                  ) {
                    navigator.clipboard
                      .writeText(t)
                      .then(ok)
                      .catch(() => fallback(b, t, ok));
                  } else {
                    fallback(b, t, ok);
                  }
                  function fallback(_b, _t, _ok) {
                    const ta = document.createElement("textarea");
                    ta.value = _t;
                    ta.style.position = "absolute";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                      document.execCommand("copy");
                      _ok();
                    } catch (_) {
                      _ok();
                    }
                    document.body.removeChild(ta);
                  }
                }}
                  >
                    <span className="cap-copy-icon-wrap">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-default" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />

                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>

                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-done" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </td>

          <td className="pricing-cell pricing-cell-window" data-window="asap">
            <span className="price-window-label">
              Default <span className="price-window-suffix">(ASAP)</span>
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.14
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.07
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.40
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window" aria-label="Gemma 4 31B IT (NVFP4) Balanced pricing: input $0.11, cached $0.06, output $0.32 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="standard">
            <span className="price-window-label">Balanced</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.11
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.06
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.32
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window pricing-row-model-last" aria-label="Gemma 4 31B IT (NVFP4) Flex pricing: input $0.07, cached $0.04, output $0.20 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="flex">
            <span className="price-window-label">Flex</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.07
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.04
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.20
            </span>
          </td>
        </tr>
      </tbody>

      <tbody className="pricing-model-group" data-model="google/gemma-4-12B-it">
        <tr className="pricing-row pricing-row-window pricing-row-model-first" aria-label="Gemma 4 12B IT Default (ASAP) pricing: input $0.30, cached $0.15, output $2.00 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" rowSpan={3} style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            <div className="pricing-cell-model-inner">
              <span className="cap-logo" data-org="gemma" role="img" aria-label="Google" />

              <div className="pricing-model-meta">
                <div className="cap-model-name">Gemma 4 12B IT</div>

                <div className="cap-slug-actions">
                  <span className="cap-slug-text" title="google/gemma-4-12B-it">
                    <code>google/gemma-4-12B-it</code>
                  </span>

                  <button
                    type="button"
                    className="cap-copy-btn"
                    aria-label="Copy google/gemma-4-12B-it"
                    onClick={(e) => {
                  const b = e.currentTarget;
                  const t = "google/gemma-4-12B-it";
                  const ok = () => {
                    b.classList.add("cap-copy-done");
                    setTimeout(
                      () => b.classList.remove("cap-copy-done"),
                      1500,
                    );
                  };
                  if (
                    navigator.clipboard &&
                    navigator.clipboard.writeText
                  ) {
                    navigator.clipboard
                      .writeText(t)
                      .then(ok)
                      .catch(() => fallback(b, t, ok));
                  } else {
                    fallback(b, t, ok);
                  }
                  function fallback(_b, _t, _ok) {
                    const ta = document.createElement("textarea");
                    ta.value = _t;
                    ta.style.position = "absolute";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                      document.execCommand("copy");
                      _ok();
                    } catch (_) {
                      _ok();
                    }
                    document.body.removeChild(ta);
                  }
                }}
                  >
                    <span className="cap-copy-icon-wrap">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-default" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />

                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>

                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-done" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </td>

          <td className="pricing-cell pricing-cell-window" data-window="asap">
            <span className="price-window-label">
              Default <span className="price-window-suffix">(ASAP)</span>
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.30
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.15
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              2.00
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window" aria-label="Gemma 4 12B IT Balanced pricing: input $0.10, cached $0.07, output $2.00 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="standard">
            <span className="price-window-label">Balanced</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.10
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.07
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="standard">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              2.00
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window pricing-row-model-last" aria-label="Gemma 4 12B IT Flex pricing: input $0.05, cached $0.02, output $1.00 per 1M tokens.">
          <td className="pricing-cell pricing-cell-window" data-window="flex">
            <span className="price-window-label">Flex</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.05
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.02
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              1.00
            </span>
          </td>
        </tr>
      </tbody>

      <tbody className="pricing-model-group" data-model="openai/gpt-oss-120b">
        <tr className="pricing-row pricing-row-window pricing-row-model-first pricing-row-model-last pricing-row-last" aria-label="gpt-oss-120b Default (ASAP) pricing: input $0.06, cached $0.03, output $0.40 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            <div className="pricing-cell-model-inner">
              <span className="cap-logo" data-org="openai" role="img" aria-label="OpenAI" />

              <div className="pricing-model-meta">
                <div className="cap-model-name">gpt-oss-120b</div>

                <div className="cap-slug-actions">
                  <span className="cap-slug-text" title="openai/gpt-oss-120b">
                    <code>openai/gpt-oss-120b</code>
                  </span>

                  <button
                    type="button"
                    className="cap-copy-btn"
                    aria-label="Copy openai/gpt-oss-120b"
                    onClick={(e) => {
                  const b = e.currentTarget;
                  const t = "openai/gpt-oss-120b";
                  const ok = () => {
                    b.classList.add("cap-copy-done");
                    setTimeout(
                      () => b.classList.remove("cap-copy-done"),
                      1500,
                    );
                  };
                  if (
                    navigator.clipboard &&
                    navigator.clipboard.writeText
                  ) {
                    navigator.clipboard
                      .writeText(t)
                      .then(ok)
                      .catch(() => fallback(b, t, ok));
                  } else {
                    fallback(b, t, ok);
                  }
                  function fallback(_b, _t, _ok) {
                    const ta = document.createElement("textarea");
                    ta.value = _t;
                    ta.style.position = "absolute";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                      document.execCommand("copy");
                      _ok();
                    } catch (_) {
                      _ok();
                    }
                    document.body.removeChild(ta);
                  }
                }}
                  >
                    <span className="cap-copy-icon-wrap">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-default" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />

                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>

                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-done" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </td>

          <td className="pricing-cell pricing-cell-window" data-window="asap">
            <span className="price-window-label">
              Default <span className="price-window-suffix">(ASAP)</span>
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.06
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.03
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.40
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

### Flex-only models

Models served with the [`flex`](/completion-windows#flex) completion window exclusively.

<div className="pricing-table-page">
  <div className="pricing-header">
    <span className="pricing-unit-callout" aria-label="Prices in US dollars per 1 million tokens">
      <span className="pricing-unit-currency">USD</span>

      <span className="pricing-unit-sep" aria-hidden="true">
        ·
      </span>

      <span className="pricing-unit-rate">
        per <span className="pricing-unit-num">1M</span> tokens
      </span>
    </span>
  </div>

  <div className="pricing-table-wrapper">
    <table className="pricing-table">
      <thead>
        <tr className="pricing-header-row">
          <th className="pricing-th pricing-th-model" style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            Model
          </th>

          <th className="pricing-th pricing-th-window" style={{ width: "8.5rem", minWidth: "8.5rem" }}>
            <a className="cap-th-link" href="/completion-windows">
              Window
            </a>
          </th>

          <th className="pricing-th pricing-th-axis" style={{ width: "9.0rem" }}>
            Input
          </th>

          <th className="pricing-th pricing-th-axis" style={{ width: "9.0rem" }}>
            Cached
          </th>

          <th className="pricing-th pricing-th-axis" style={{ width: "9.0rem" }}>
            Output
          </th>
        </tr>
      </thead>

      <tbody className="pricing-model-group" data-model="Qwen/Qwen3.6-35B-A3B">
        <tr className="pricing-row pricing-row-window pricing-row-model-first pricing-row-model-last pricing-row-last" aria-label="Qwen3.6 35B A3B Flex pricing: input $0.05, cached $0.02, output $0.40 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            <div className="pricing-cell-model-inner">
              <span className="cap-logo" data-org="qwen" role="img" aria-label="Qwen" />

              <div className="pricing-model-meta">
                <div className="cap-model-name">Qwen3.6 35B A3B</div>

                <div className="cap-slug-actions">
                  <span className="cap-slug-text" title="Qwen/Qwen3.6-35B-A3B">
                    <code>Qwen/Qwen3.6-35B-A3B</code>
                  </span>

                  <button
                    type="button"
                    className="cap-copy-btn"
                    aria-label="Copy Qwen/Qwen3.6-35B-A3B"
                    onClick={(e) => {
                  const b = e.currentTarget;
                  const t = "Qwen/Qwen3.6-35B-A3B";
                  const ok = () => {
                    b.classList.add("cap-copy-done");
                    setTimeout(
                      () => b.classList.remove("cap-copy-done"),
                      1500,
                    );
                  };
                  if (
                    navigator.clipboard &&
                    navigator.clipboard.writeText
                  ) {
                    navigator.clipboard
                      .writeText(t)
                      .then(ok)
                      .catch(() => fallback(b, t, ok));
                  } else {
                    fallback(b, t, ok);
                  }
                  function fallback(_b, _t, _ok) {
                    const ta = document.createElement("textarea");
                    ta.value = _t;
                    ta.style.position = "absolute";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                      document.execCommand("copy");
                      _ok();
                    } catch (_) {
                      _ok();
                    }
                    document.body.removeChild(ta);
                  }
                }}
                  >
                    <span className="cap-copy-icon-wrap">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-default" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />

                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>

                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="cap-copy-icon cap-copy-icon-done" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </td>

          <td className="pricing-cell pricing-cell-window" data-window="flex">
            <span className="price-window-label">Flex</span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Input" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.05
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.02
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="flex">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.40
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

### Notes

* See [Completion Windows](/completion-windows) for how to use `balanced` and `flex` for lower token prices.
  * Not all core models support all windows yet. We regularly bring up new models and expand completion window support for existing ones based on demand. If you have a need that's not represented above, <a href="mailto:support@sailresearch.com">get in touch</a>.
* Prompt caching is implicit, based on prefix matching. Optionally, you may use [`prompt_cache_key`](/api-reference/responses-api/create-a-response#body-prompt-cache-key) as a routing hint to help maximize cache hit rates.
* See [Models](/models) for capabilities and other details on supported models.
* To see what these rates add up to on a full agent workload, use the
  [agent cost calculator](/cost-calculator).

<hr className="pricing-section-divider" />

## Sailbox

<div className="sailbox-pricing-table">
  | Dimension                                                                                                                                                                                | Price                                       |
  | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
  | Used vCPU/hour <span className="sail-price-info"><Tooltip tip="Guest /proc/stat CPU time, sampled about every 15 s"><Icon icon="circle-info" size={14} /></Tooltip></span>               | \$0.015                                     |
  | Used RAM (GiB)/hour <span className="sail-price-info"><Tooltip tip="Guest MemTotal minus MemAvailable, sampled about every 15 s"><Icon icon="circle-info" size={14} /></Tooltip></span>  | \$0.008                                     |
  | Used NVMe disk (GiB)/hour <span className="sail-price-info"><Tooltip tip="Guest statfs used bytes on /, sampled about every 15 s"><Icon icon="circle-info" size={14} /></Tooltip></span> | \$0.0007                                    |
  | Volume storage (GiB)/hour                                                                                                                                                                | \$0.000411                                  |
  | S Sailbox creation                                                                                                                                                                       | \$0.005 (**waived** for Pro and Enterprise) |
  | M Sailbox creation                                                                                                                                                                       | \$0.01 (**waived** for Pro and Enterprise)  |
  | L Sailbox creation                                                                                                                                                                       | \$0.012 (**waived** for Pro and Enterprise) |
</div>

### Notes

* Usage accrues only while a Sailbox is running.
* Volume storage is billed separately for each hour the volume exists, even
  when attached Sailboxes are sleeping, until it's deleted.
* For more details, see the [Sailbox billing overview](/sailboxes-billing).

<hr className="pricing-section-divider" />

<div id="plans" className="pricing-plans-anchor" aria-hidden="true" />

## Pricing Plans

<div className="plan-comparison">
  <div className="plan-column" role="article">
    <div className="plan-column-header">
      <h3>Free</h3>

      <div className="plan-price-row">
        <p className="plan-price">
          <span className="plan-price-main">Free</span>
        </p>

        <span className="plan-price-note">to start, pay-as-you-go</span>
      </div>

      <p className="plan-tagline">For getting started with Sail</p>
    </div>

    <ul className="plan-benefits">
      <li>\$5/month in free credits when you attach a payment method</li>
      <li>Usage-based pricing with prepaid credits</li>
      <li>Up to 4 seats</li>
      <li>Up to 100 concurrent Sailboxes</li>

      <li>
        Support via{" "}

        <a href="https://www.sailresearch.com/support" target="_blank" rel="noopener noreferrer">
          email
        </a>

        {" "}

        and the{" "}

        <a href="https://www.sailresearch.com/support" target="_blank" rel="noopener noreferrer">
          Sail Research Community Slack
        </a>
      </li>
    </ul>
  </div>

  <div className="plan-column plan-column-featured" role="article">
    <div className="plan-column-header">
      <h3>Pro</h3>

      <p className="plan-price">
        <span className="plan-price-main">\$250</span>
        <span className="plan-price-suffix">/month</span>
      </p>

      <p className="plan-tagline">Expanded access once you're ready</p>
    </div>

    <ul className="plan-benefits">
      <li>
        \$100/month in included credits, with an additional \$150 in your
        first month
      </li>

      <li>Usage-based pricing with prepaid credits</li>
      <li>Unlimited seats</li>
      <li>Increased access to model capacity and higher rate limits</li>
      <li>Up to 5,000 concurrent Sailboxes</li>
      <li>Fully waived Sailbox creation fees for all sizes</li>
      <li>US-only inference with a 20% surcharge on per-token pricing</li>

      <li>
        Expanded request and usage history

        <span className="sail-price-info">
          <Tooltip tip="30d usage history, 24h request history">
            <Icon icon="circle-info" size={14} />
          </Tooltip>
        </span>
      </li>

      <li>
        Priority support via{" "}

        <a href="https://www.sailresearch.com/support" target="_blank" rel="noopener noreferrer">
          email
        </a>

        {" "}

        and the{" "}

        <a href="https://www.sailresearch.com/support" target="_blank" rel="noopener noreferrer">
          Sail Research Community Slack
        </a>
      </li>
    </ul>
  </div>

  <div className="plan-column plan-column-enterprise" role="article">
    <div className="plan-column-header">
      <h3>Enterprise</h3>

      <p className="plan-price">
        <span className="plan-price-main">Custom</span>
      </p>

      <p className="plan-tagline">
        Enterprise-grade customization and support
      </p>
    </div>

    <ul className="plan-benefits">
      <li>Volume pricing, billed monthly in arrears</li>
      <li>HIPAA support with a signed BAA</li>
      <li>Signed MSA and DPA</li>
      <li>US-only inference with a 10% surcharge on per-token pricing</li>
      <li>Full usage history through the API, subject to retention</li>
      <li>Custom model bringups</li>
      <li>Uptime and latency SLAs</li>
      <li>Early access to new features</li>
      <li>Dedicated support via a private Slack channel</li>
      <li>Plus all of the additional benefits in Pro</li>
    </ul>
  </div>
</div>

### Notes

* You can upgrade to Pro at any time from your [billing page](https://app.sailresearch.com/sign-in?redirect_url=%2Fbilling%3Fupgrade%3Dpro).
* [Get in touch](https://www.sailresearch.com/support) to inquire about an Enterprise plan that suits your needs.
