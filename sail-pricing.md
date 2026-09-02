> ## Documentation Index
> Fetch the complete documentation index at: https://docs.sailresearch.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Pricing

> Per-token pricing for Sail inference

## Core models

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

      <tbody className="pricing-model-group" data-model="zai-org/GLM-5.3">
        <tr className="pricing-row pricing-row-window pricing-row-model-first" aria-label="GLM-5.3 Default (ASAP) pricing: input $1.40, cached $0.26, output $4.40 per 1M tokens.">
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

              1.40
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.26
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              4.40
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

      <tbody className="pricing-model-group" data-model="deepseek-ai/DeepSeek-V4-Flash-0731">
        <tr className="pricing-row pricing-row-window pricing-row-model-first pricing-row-model-last" aria-label="DeepSeek V4 Flash 0731 Default (ASAP) pricing: input $0.09, cached $0.02, output $0.18 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" style={{ width: "18.0rem", minWidth: "18.0rem" }}>
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
      </tbody>

      <tbody className="pricing-model-group" data-model="zai-org/GLM-5.2-FP8">
        <tr className="pricing-row pricing-row-window pricing-row-model-first" aria-label="GLM-5.2 Default (ASAP) pricing: input $0.80, cached $0.16, output $3.00 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" rowSpan={3} style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            <div className="pricing-cell-model-inner">
              <span className="cap-logo" data-org="zhipu" role="img" aria-label="Z.ai" />

              <div className="pricing-model-meta">
                <div className="cap-model-name">GLM-5.2</div>

                <div className="cap-slug-actions">
                  <span className="cap-slug-text" title="zai-org/GLM-5.2-FP8">
                    <code>zai-org/GLM-5.2-FP8</code>
                  </span>

                  <button
                    type="button"
                    className="cap-copy-btn"
                    aria-label="Copy zai-org/GLM-5.2-FP8"
                    onClick={(e) => {
                  const b = e.currentTarget;
                  const t = "zai-org/GLM-5.2-FP8";
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

              0.80
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Cached" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              0.16
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="asap">
            <span className="price-amount">
              <span className="price-currency" aria-hidden="true">
                \$
              </span>

              3.00
            </span>
          </td>
        </tr>

        <tr className="pricing-row pricing-row-window" aria-label="GLM-5.2 Balanced pricing: input $0.50, cached $0.12, output $2.50 per 1M tokens.">
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

        <tr className="pricing-row pricing-row-window pricing-row-model-last" aria-label="GLM-5.2 Flex pricing: input $0.40, cached $0.08, output $1.80 per 1M tokens.">
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

      <tbody className="pricing-model-group" data-model="openai/gpt-oss-120b">
        <tr className="pricing-row pricing-row-window pricing-row-model-first pricing-row-model-last" aria-label="gpt-oss-120b Default (ASAP) pricing: input $0.06, cached $0.03, output $0.40 per 1M tokens.">
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
          <td className="pricing-cell pricing-cell-model" rowSpan={2} style={{ width: "18.0rem", minWidth: "18.0rem" }}>
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

        <tr className="pricing-row pricing-row-window pricing-row-model-last pricing-row-last" aria-label="Gemma 4 31B IT (NVFP4) Balanced pricing: input $0.07, cached $0.05, output $0.40 per 1M tokens.">
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

              0.05
            </span>
          </td>

          <td className="pricing-cell pricing-cell-price" data-axis="Output" data-window="standard">
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

## Flex-only models

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
        <tr className="pricing-row pricing-row-window pricing-row-model-first pricing-row-model-last" aria-label="Qwen3.6 35B A3B Flex pricing: input $0.05, cached $0.015, output $0.40 per 1M tokens.">
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

              0.015
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

      <tbody className="pricing-model-group" data-model="nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16">
        <tr className="pricing-row pricing-row-window pricing-row-model-first pricing-row-model-last pricing-row-last" aria-label="Nemotron 3 Super 120B A12B BF16 Flex pricing: input $0.25, cached $0.15, output $0.75 per 1M tokens.">
          <td className="pricing-cell pricing-cell-model" style={{ width: "18.0rem", minWidth: "18.0rem" }}>
            <div className="pricing-cell-model-inner">
              <span className="cap-logo" data-org="nvidia" role="img" aria-label="NVIDIA" />

              <div className="pricing-model-meta">
                <div className="cap-model-name">
                  Nemotron 3 Super 120B A12B BF16
                </div>

                <div className="cap-slug-actions">
                  <span className="cap-slug-text" title="nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16">
                    <code>nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16</code>
                  </span>

                  <button
                    type="button"
                    className="cap-copy-btn"
                    aria-label="Copy nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16"
                    onClick={(e) => {
                  const b = e.currentTarget;
                  const t = "nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16";
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

              0.25
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

              0.75
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

## Notes

* See [Completion Windows](/completion-windows) for how to use `balanced` and `flex` for lower token prices.
  * Not all core models support all windows yet. We regularly bring up new models and expand completion window support for existing ones based on demand. If you have a need that's not represented above, <a href="mailto:support@sailresearch.com">get in touch</a>.
* Prompt caching is implicit, based on prefix matching. Optionally, you may use [`prompt_cache_key`](/api-reference/responses-api/create-a-response#body-prompt-cache-key) as a routing hint to help maximize cache hit rates.
* See [Models](/models) for capabilities and other details on supported models.
* To see what these rates add up to on a full agent workload, use the
  [agent cost calculator](/cost-calculator).
