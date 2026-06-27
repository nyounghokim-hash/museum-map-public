export default function MapCriticalStyles() {
  return (
    <>
        <style
          id="mm-critical-mobile-2"
          dangerouslySetInnerHTML={{
            __html: `
              @media (max-width: 767px) {
                .mm-map-home-header {
                  display: none !important;
                }
                main.mm-map-shell {
                  position: relative !important;
                  display: flex !important;
                  width: 100vw !important;
                  max-width: 100vw !important;
                  height: var(--mm-viewport-height, 100dvh) !important;
                  min-height: 320px !important;
                  overflow: hidden !important;
                  padding-bottom: 0 !important;
                  background: #eef6ff !important;
                }
                .mm-map-shell > .relative,
                .mm-map-shell .maplibregl-map,
                .mm-map-shell canvas {
                  min-width: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                }
                .mm-map2-top {
                  position: absolute !important;
                  left: 0 !important;
                  right: 0 !important;
                  top: max(12px, env(safe-area-inset-top, 0px)) !important;
                  z-index: 80 !important;
                  padding: 0 18px !important;
                  pointer-events: none !important;
                }
                .mm-map2-search-row,
                .mm-map2-pill-row {
                  display: flex !important;
                  align-items: center !important;
                  gap: 10px !important;
                  width: 100% !important;
                }
                .mm-map2-search {
                  flex: 1 1 auto !important;
                  min-width: 0 !important;
                  height: 58px !important;
                  display: flex !important;
                  align-items: center !important;
                  gap: 10px !important;
                  padding: 0 18px !important;
                  border-radius: 999px !important;
                  color: #0f172a !important;
                  background: rgba(255,255,255,.96) !important;
                  border: 1px solid rgba(226,232,240,.8) !important;
                  box-shadow: 0 12px 30px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.9) !important;
                  backdrop-filter: blur(18px) saturate(160%) !important;
                  -webkit-backdrop-filter: blur(18px) saturate(160%) !important;
                  pointer-events: auto !important;
                }
                .mm-map2-search input {
                  flex: 1 1 auto !important;
                  min-width: 0 !important;
                  display: block !important;
                  border: 0 !important;
                  outline: 0 !important;
                  background: transparent !important;
                  color: #0f172a !important;
                  font-size: 15px !important;
                  font-weight: 400 !important;
                  line-height: 1 !important;
                }
                .mm-map2-search input::placeholder {
                  color: #94a3b8 !important;
                  font-weight: 400 !important;
                }
                .mm-map2-search button,
                .mm-map2-icon-pill,
                .mm-map2-tool-pill,
                .mm-map2-float-btn {
                  display: inline-flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  border: 0 !important;
                  outline: 0 !important;
                  text-decoration: none !important;
                  pointer-events: auto !important;
                }
                .mm-map2-icon-pill {
                  flex: 0 0 54px !important;
                  width: 54px !important;
                  height: 54px !important;
                  border-radius: 999px !important;
                  color: #334155 !important;
                  background: rgba(255,255,255,.96) !important;
                  box-shadow: 0 12px 30px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.9) !important;
                }
                .mm-map2-pill-row {
                  display: grid !important;
                  grid-template-columns: 54px !important;
                  position: absolute !important;
                  top: 74px !important;
                  right: 18px !important;
                  width: 54px !important;
                  align-items: start !important;
                  gap: 8px !important;
                  margin-top: 0 !important;
                  justify-content: stretch !important;
                  overflow: visible !important;
                  padding-bottom: 8px !important;
                  scrollbar-width: none !important;
                }
                .mm-map2-trip-slot {
                  min-width: 0 !important;
                  justify-self: start !important;
                  pointer-events: auto !important;
                }
                .mm-map2-tool-stack {
                  display: flex !important;
                  flex-direction: column !important;
                  align-items: flex-end !important;
                  justify-self: end !important;
                  gap: 8px !important;
                  pointer-events: auto !important;
                }
                .mm-map2-top.is-left-handed .mm-map2-pill-row {
                  left: 18px !important;
                  right: auto !important;
                }
                .mm-map2-top.is-left-handed .mm-map2-tool-stack {
                  align-items: flex-start !important;
                  justify-self: start !important;
                }
                .mm-map2-trip-cluster.is-left-handed {
                  left: auto !important;
                  right: 18px !important;
                  flex-direction: row-reverse !important;
                  justify-content: flex-end !important;
                }
                .mm-map2-top.is-left-handed > .mm-map2-trip-anchor {
                  left: auto !important;
                  right: 18px !important;
                  justify-content: flex-end !important;
                }
                .mm-map2-top.is-left-handed > .mm-map2-trip-anchor.has-new-museums {
                  left: auto !important;
                  right: 82px !important;
                  width: calc(100vw - 100px) !important;
                }
                .mm-map2-pill-row::-webkit-scrollbar {
                  display: none !important;
                }
                .mm-map2-tool-pill {
                  flex: 0 0 auto !important;
                  height: 46px !important;
                  gap: 7px !important;
                  padding: 0 15px !important;
                  border-radius: 999px !important;
                  color: #0f172a !important;
                  background: rgba(255,255,255,.96) !important;
                  box-shadow: 0 12px 28px rgba(15,23,42,.13), inset 0 1px 0 rgba(255,255,255,.9) !important;
                  font-size: 14px !important;
                  font-weight: 850 !important;
                  white-space: nowrap !important;
                }
                .mm-map2-tool-stack .mm-map2-tool-pill {
                  width: 54px !important;
                  min-width: 54px !important;
                  height: 54px !important;
                  padding: 0 !important;
                  border-radius: 999px !important;
                  box-shadow: 0 4px 10px rgba(15,23,42,.06) !important;
                }
                .mm-map2-trip-pill {
                  width: auto !important;
                  min-width: 0 !important;
                  height: 42px !important;
                  padding: 0 14px !important;
                  font-size: 13px !important;
                  font-weight: 520 !important;
                  box-shadow: 0 4px 10px rgba(15,23,42,.05) !important;
                }
                .mm-map2-trip-pill.is-on-trip {
                  background: #2563eb !important;
                  border-color: #2563eb !important;
                  color: #fff !important;
                }
                .mm-map2-tool-pill strong {
                  color: #2563eb !important;
                  font-weight: 850 !important;
                }
                .mm-map2-tool-pill-icon {
                  width: 46px !important;
                  padding: 0 !important;
                }
                .mm-map2-tool-pill-icon svg {
                  color: #2563eb !important;
                }
                .mm-map2-icon-pill.is-active,
                .mm-map2-tool-pill.is-active {
                  color: #fff !important;
                  background: #2563eb !important;
                }
                .mm-map2-tool-pill.is-active strong {
                  color: currentColor !important;
                }
                .mm-map2-floating-list,
                .mm-map2-category-menu {
                  position: absolute !important;
                  z-index: 120 !important;
                  overflow: hidden !important;
                  border-radius: 24px !important;
                  background: rgba(255,255,255,.98) !important;
                  border: 1px solid rgba(226,232,240,.82) !important;
                  box-shadow: 0 26px 60px rgba(15,23,42,.18) !important;
                  pointer-events: auto !important;
                }
                .mm-map2-category-menu {
                  left: auto !important;
                  right: 80px !important;
                  width: min(300px, calc(100vw - 104px)) !important;
                }
                .mm-map2-category-menu.is-left-handed {
                  left: 80px !important;
                  right: auto !important;
                  width: min(300px, calc(100vw - 104px)) !important;
                  max-width: calc(100vw - 104px) !important;
                }
                .mm-map2-floating-list {
                  top: calc(max(12px, env(safe-area-inset-top, 0px)) + 58px) !important;
                  z-index: 150 !important;
                  max-height: 290px !important;
                  overflow-y: auto !important;
                }
                .mm-map2-search-result {
                  color: #0f172a !important;
                  border-color: rgba(226,232,240,.72) !important;
                }
                .mm-map2-search-result:hover {
                  background: #eff6ff !important;
                }
                .mm-map2-search-result-title {
                  color: #0f172a !important;
                  font-weight: 650 !important;
                }
                .mm-cluster-popup2-title-row strong {
                  color: #0f172a !important;
                  font-size: 15px !important;
                  font-weight: 650 !important;
                  line-height: 1.25 !important;
                  letter-spacing: 0 !important;
                }
                .mm-map2-search-result-subtitle {
                  color: #64748b !important;
                  font-weight: 500 !important;
                }
                .mm-map2-category-menu {
                  top: calc(max(12px, env(safe-area-inset-top, 0px)) + 124px) !important;
                  display: flex !important;
                  flex-direction: column !important;
                  gap: 0 !important;
                  padding: 0 !important;
                  max-height: min(360px, calc(100dvh - 250px)) !important;
                  overflow: hidden !important;
                }
                .mm-map2-category-menu-head {
                  display: flex !important;
                  align-items: center !important;
                  justify-content: space-between !important;
                  gap: 10px !important;
                  padding: 12px 16px !important;
                  border-bottom: 1px solid rgba(226,232,240,.78) !important;
                }
                .mm-map2-category-menu-grid {
                  display: grid !important;
                  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                  gap: 8px !important;
                  padding: 12px !important;
                  max-height: min(306px, calc(100dvh - 306px)) !important;
                  overflow-y: auto !important;
                }
                .mm-map2-category-menu-grid button {
                  min-width: 0 !important;
                  width: 100% !important;
                  min-height: 46px !important;
                  padding: 12px 11px !important;
                  border-radius: 16px !important;
                  color: #475569 !important;
                  background: #f8fafc !important;
                  font-size: 12px !important;
                  font-weight: 500 !important;
                  text-align: left !important;
                  word-break: keep-all !important;
                }
                .mm-map2-category-label {
                  min-width: 0 !important;
                  overflow: hidden !important;
                  text-overflow: ellipsis !important;
                  white-space: nowrap !important;
                }
                .mm-map2-category-count {
                  display: inline-flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  min-width: 22px !important;
                  height: 18px !important;
                  margin-left: auto !important;
                  padding: 0 6px !important;
                  border-radius: 999px !important;
                  color: #2563eb !important;
                  background: rgba(37,99,235,.09) !important;
                  font-size: 10px !important;
                  font-weight: 750 !important;
                  line-height: 1 !important;
                }
                .mm-map2-category-menu-grid button.is-active {
                  color: #fff !important;
                  background: #2563eb !important;
                }
                .mm-map2-category-menu-grid button.is-active .mm-map2-category-count,
                .mm-map2-side-grid button.is-active .mm-map2-category-count {
                  color: #fff !important;
                  background: rgba(255,255,255,.22) !important;
                }
                .mm-map2-float-actions {
                  position: absolute !important;
                  left: 20px !important;
                  right: 20px !important;
                  bottom: 222px !important;
                  z-index: 62 !important;
                  display: flex !important;
                  align-items: center !important;
                  justify-content: flex-end !important;
                  pointer-events: none !important;
                }
                .mm-map2-float-btn {
                  width: 54px !important;
                  height: 54px !important;
                  border-radius: 999px !important;
                  color: #334155 !important;
                  background: rgba(255,255,255,.96) !important;
                  box-shadow: 0 16px 34px rgba(15,23,42,.16), inset 0 1px 0 rgba(255,255,255,.9) !important;
                }
                .mm-map2-side-layer {
                  position: fixed !important;
                  inset: 0 !important;
                  z-index: 130 !important;
                  pointer-events: auto !important;
                }
                .mm-map2-side-backdrop {
                  position: absolute !important;
                  inset: 0 !important;
                  background: rgba(15,23,42,.22) !important;
                  border: 0 !important;
                }
                .mm-map2-side-menu {
                  position: absolute !important;
                  top: max(10px, env(safe-area-inset-top, 0px)) !important;
                  right: 12px !important;
                  width: min(324px, calc(100vw - 24px)) !important;
                  max-height: calc(100dvh - max(10px, env(safe-area-inset-top, 0px)) - 112px) !important;
                  overflow-y: auto !important;
                  padding: 16px !important;
                  border-radius: 28px !important;
                  color: #0f172a !important;
                  background: rgba(255,255,255,.98) !important;
                  border: 1px solid rgba(226,232,240,.86) !important;
                  box-shadow: 0 30px 80px rgba(15,23,42,.24), inset 0 1px 0 rgba(255,255,255,.94) !important;
                  backdrop-filter: blur(20px) saturate(170%) !important;
                  -webkit-backdrop-filter: blur(20px) saturate(170%) !important;
                }
                .mm-map2-side-actions,
                .mm-map2-side-grid {
                  display: grid !important;
                  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                  gap: 8px !important;
                }
                .mm-map2-side-actions {
                  margin-bottom: 16px !important;
                }
                .mm-map2-side-grid {
                  margin-top: 8px !important;
                }
                .mm-map2-side-grid button.is-active {
                  color: #fff !important;
                  background: #2563eb !important;
                }
                .mm-map2-place-sheet {
                  position: absolute !important;
                  left: 0 !important;
                  right: 0 !important;
                  bottom: calc(78px + env(safe-area-inset-bottom, 0px)) !important;
                  z-index: 70 !important;
                  min-height: 124px !important;
                  padding: 10px 18px 16px !important;
                  border-radius: 30px 30px 0 0 !important;
                  color: #0f172a !important;
                  background: rgba(255,255,255,.97) !important;
                  border-top: 1px solid rgba(226,232,240,.78) !important;
                  box-shadow: 0 -22px 56px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.95) !important;
                  pointer-events: auto !important;
                }
                .mm-map2-place-sheet.is-expanded {
                  min-height: min(520px, calc(100dvh - 158px)) !important;
                }
                .mm-map2-sheet-handle {
                  display: flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  width: 100% !important;
                  height: 18px !important;
                }
                .mm-map2-sheet-handle span {
                  display: block !important;
                  width: 44px !important;
                  height: 5px !important;
                  border-radius: 999px !important;
                  background: #cbd5e1 !important;
                }
                .mm-map2-preview-card {
                  width: 100% !important;
                  display: flex !important;
                  align-items: center !important;
                  gap: 14px !important;
                  padding: 10px 0 2px !important;
                  text-align: left !important;
                  color: #0f172a !important;
                }
                .mm-map2-preview-image,
                .mm-map2-list-image {
                  flex: 0 0 auto !important;
                  overflow: hidden !important;
                  background: #eaf2ff !important;
                }
                .mm-map2-preview-image {
                  width: 112px !important;
                  height: 82px !important;
                  border-radius: 18px !important;
                }
                .mm-map2-preview-image img,
                .mm-map2-list-image img {
                  width: 100% !important;
                  height: 100% !important;
                  object-fit: cover !important;
                }
                .mm-map2-preview-card h3 {
                  margin: 0 0 8px !important;
                  color: #0f172a !important;
                  font-size: 18px !important;
                  font-weight: 1000 !important;
                  line-height: 1.12 !important;
                }
                .mm-map2-preview-card p {
                  display: flex !important;
                  min-width: 0 !important;
                  align-items: center !important;
                  gap: 8px !important;
                  color: #64748b !important;
                  font-size: 13px !important;
                  font-weight: 850 !important;
                }
                .mm-map2-bookmark {
                  width: 48px !important;
                  height: 48px !important;
                  display: inline-flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  flex: 0 0 auto !important;
                  border-radius: 999px !important;
                  color: #2563eb !important;
                  background: rgba(255,255,255,.84) !important;
                  box-shadow: 0 8px 24px rgba(15,23,42,.08) !important;
                }
                .mm-map2-list-panel {
                  display: flex !important;
                  flex-direction: column !important;
                  height: min(460px, calc(100dvh - 206px)) !important;
                  padding-top: 2px !important;
                }
                .mm-map2-list-header {
                  display: flex !important;
                  align-items: center !important;
                  justify-content: space-between !important;
                  gap: 12px !important;
                  padding: 8px 0 12px !important;
                }
                .mm-map2-list-header strong {
                  color: #0f172a !important;
                  font-size: 18px !important;
                  font-weight: 1000 !important;
                }
                .mm-map2-list-header span,
                .mm-map2-list-item small {
                  color: #64748b !important;
                  font-size: 12px !important;
                  font-weight: 850 !important;
                }
                .mm-map2-list-header button {
                  width: 38px !important;
                  height: 38px !important;
                  display: inline-flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  flex: 0 0 auto !important;
                  border-radius: 999px !important;
                  color: #475569 !important;
                  background: #f1f5f9 !important;
                }
                .mm-map2-scroll-list {
                  min-height: 0 !important;
                  flex: 1 1 auto !important;
                  overflow-y: auto !important;
                  padding: 0 0 12px !important;
                }
                .mm-map2-list-item {
                  width: 100% !important;
                  display: flex !important;
                  align-items: center !important;
                  gap: 12px !important;
                  padding: 10px 0 !important;
                  text-align: left !important;
                  border-bottom: 1px solid rgba(226,232,240,.72) !important;
                }
                .mm-map2-list-image {
                  width: 68px !important;
                  height: 58px !important;
                  border-radius: 16px !important;
                }
                .mm-map2-list-item strong {
                  display: block !important;
                  overflow: hidden !important;
                  color: #0f172a !important;
                  font-size: 14px !important;
                  font-weight: 950 !important;
                  text-overflow: ellipsis !important;
                  white-space: nowrap !important;
                }
                .mobile-bottom-nav.mm-mobile-nav2 {
                  position: fixed !important;
                  left: 0 !important;
                  right: 0 !important;
                  bottom: 0 !important;
                  z-index: 90 !important;
                  display: block !important;
                  width: 100vw !important;
                  max-width: 100vw !important;
                  pointer-events: none !important;
                }
                .mm-mobile-nav2-inner {
                  pointer-events: auto !important;
                  display: grid !important;
                  grid-template-columns: 1fr 1fr 78px 1fr 1fr !important;
                  align-items: end !important;
                  min-height: 78px !important;
                  padding: 8px 14px max(8px, env(safe-area-inset-bottom, 0px)) !important;
                  border-radius: 28px 28px 0 0 !important;
                  background: rgba(255,255,255,.96) !important;
                  border-top: 1px solid rgba(226,232,240,.76) !important;
                  box-shadow: 0 -18px 48px rgba(15,23,42,.10), inset 0 1px 0 rgba(255,255,255,.88) !important;
                  backdrop-filter: blur(18px) saturate(170%) !important;
                  -webkit-backdrop-filter: blur(18px) saturate(170%) !important;
                }
                .mm-mobile-nav2-item,
                .mm-mobile-nav2-center {
                  min-width: 0 !important;
                  display: flex !important;
                  flex-direction: column !important;
                  align-items: center !important;
                  justify-content: center !important;
                  gap: 3px !important;
                  color: #64748b !important;
                  text-align: center !important;
                  text-decoration: none !important;
                }
                .mm-mobile-nav2-item {
                  height: 58px !important;
                }
                .mm-mobile-nav2-center {
                  height: 70px !important;
                  justify-content: flex-end !important;
                  color: #0f172a !important;
                  background: transparent !important;
                  border: 0 !important;
                }
                .mm-mobile-nav2-item.is-active {
                  color: #1d4ed8 !important;
                }
                .mm-mobile-nav2-item span:last-child,
                .mm-mobile-nav2-center strong {
                  max-width: 100% !important;
                  overflow: hidden !important;
                  color: currentColor !important;
                  font-size: 11px !important;
                  font-weight: 900 !important;
                  line-height: 1.1 !important;
                  text-overflow: ellipsis !important;
                  white-space: nowrap !important;
                }
                .mm-mobile-nav2-center > span {
                  width: 58px !important;
                  height: 58px !important;
                  display: inline-flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  border-radius: 999px !important;
                  background: linear-gradient(180deg,#2563eb 0%,#123fbd 100%) !important;
                  border: 1px solid rgba(255,255,255,.62) !important;
                  box-shadow: 0 16px 34px rgba(37,99,235,.34), inset 0 1px 0 rgba(255,255,255,.30) !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-search,
                :is(.dark, [data-theme="dark"]) .mm-map2-icon-pill,
                :is(.dark, [data-theme="dark"]) .mm-map2-tool-pill,
                :is(.dark, [data-theme="dark"]) .mm-map2-float-btn {
                  color: #e2e8f0 !important;
                  background: rgba(7,20,38,.92) !important;
                  border-color: rgba(96,165,250,.22) !important;
                  box-shadow: 0 14px 34px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.08) !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-search input,
                :is(.dark, [data-theme="dark"]) .mm-map2-search-result-title,
                :is(.dark, [data-theme="dark"]) .mm-cluster-popup2-title-row strong,
                :is(.dark, [data-theme="dark"]) .mm-map2-side-head strong {
                  color: #f8fafc !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-search input {
                  background: transparent !important;
                  background-color: transparent !important;
                  border-color: transparent !important;
                  box-shadow: none !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-tool-pill-icon svg {
                  color: #93c5fd !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-search-result,
                :is(.dark, [data-theme="dark"]) .mm-map2-floating-list,
                :is(.dark, [data-theme="dark"]) .mm-map2-category-menu,
                :is(.dark, [data-theme="dark"]) .mm-map2-side-menu {
                  color: #f8fafc !important;
                  background: rgba(7,20,38,.96) !important;
                  border-color: rgba(96,165,250,.22) !important;
                  box-shadow: 0 30px 80px rgba(0,0,0,.44) !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-search-result-subtitle,
                :is(.dark, [data-theme="dark"]) .mm-map2-side-head span,
                :is(.dark, [data-theme="dark"]) .mm-map2-side-section > span {
                  color: #cbd5e1 !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-category-menu-grid button,
                :is(.dark, [data-theme="dark"]) .mm-map2-side-grid button {
                  color: #e2e8f0 !important;
                  background: rgba(15,23,42,.88) !important;
                }
                :is(.dark, [data-theme="dark"]) .mm-map2-side-grid button.is-active,
                :is(.dark, [data-theme="dark"]) .mm-map2-category-menu-grid button.is-active,
                :is(.dark, [data-theme="dark"]) .mm-map2-icon-pill.is-active,
                :is(.dark, [data-theme="dark"]) .mm-map2-tool-pill.is-active {
                  color: #fff !important;
                  background: #2563eb !important;
                }
              }
            `,
          }}
        />
        <style
          id="mm-map-home-popover-unified-v4"
          dangerouslySetInnerHTML={{
            __html: `
              .mm-weather-popup2,
              .mm-nearby-popup2,
              .mm-map2-category-menu {
                width: min(320px, calc(100vw - 24px)) !important;
                max-width: min(320px, calc(100vw - 24px)) !important;
                padding: 0 !important;
                overflow: hidden !important;
                border-radius: 24px !important;
                color: #0f172a !important;
                background: radial-gradient(circle at 88% 8%, rgba(37,99,235,.07), transparent 34%), rgba(255,255,255,.98) !important;
                border: 1px solid rgba(226,232,240,.9) !important;
                box-shadow: 0 20px 48px rgba(15,23,42,.13), inset 0 1px 0 rgba(255,255,255,.95) !important;
                backdrop-filter: blur(22px) saturate(170%) !important;
                -webkit-backdrop-filter: blur(22px) saturate(170%) !important;
              }
              .mm-weather-popup2-head,
              .mm-map2-category-menu-head,
              .mm-nearby-popup2 > div:first-child {
                min-height: 52px !important;
                padding: 12px 16px !important;
                border-bottom: 1px solid rgba(226,232,240,.78) !important;
                background: transparent !important;
              }
              .mm-weather-popup2 h3,
              .mm-map2-category-menu-head h3,
              .mm-nearby-popup2 h3 {
                color: #0f172a !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                line-height: 1.2 !important;
                letter-spacing: 0 !important;
              }
              .mm-weather-popup2-head-icon,
              .mm-map2-category-menu-head-icon {
                width: 28px !important;
                height: 28px !important;
                color: #2563eb !important;
                background: #eff6ff !important;
                border: 1px solid rgba(191,219,254,.62) !important;
                border-radius: 999px !important;
              }
              .mm-map2-category-menu-close,
              .mm-weather-popup2 button[aria-label],
              .mm-nearby-popup2 button[aria-label] {
                color: #64748b !important;
                background: transparent !important;
                box-shadow: none !important;
              }
              .mm-map2-category-menu-grid {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 8px !important;
                padding: 12px !important;
                max-height: min(306px, calc(100dvh - 306px)) !important;
                overflow-y: auto !important;
              }
              .mm-map2-category-menu-grid button {
                min-width: 0 !important;
                width: 100% !important;
                min-height: 46px !important;
                padding: 12px 11px !important;
                border-radius: 16px !important;
                color: #334155 !important;
                background: #f8fafc !important;
                border: 1px solid rgba(226,232,240,.74) !important;
                box-shadow: none !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                line-height: 1.2 !important;
                text-align: left !important;
                word-break: keep-all !important;
              }
              .mm-map2-new-museum-title {
                font-weight: 600 !important;
              }
              .mm-map2-category-menu-grid button.is-active {
                color: #fff !important;
                background: linear-gradient(180deg,#2f75ff 0%,#1d4ed8 100%) !important;
                border-color: rgba(37,99,235,.92) !important;
              }
              .mm-weather-popup2-body {
                padding: 16px !important;
              }
              .mm-weather-popup2-hero,
              .mm-weather-popup2-rec {
                border-radius: 18px !important;
                background: rgba(248,250,252,.94) !important;
                border: 1px solid rgba(226,232,240,.88) !important;
                box-shadow: none !important;
              }
              .mm-weather-popup2-temp {
                color: #0f172a !important;
                font-weight: 760 !important;
              }
              .mm-weather-popup2-desc,
              .mm-weather-popup2-provider,
              .mm-weather-popup2-location {
                color: #64748b !important;
                font-weight: 560 !important;
              }
              .mm-nearby-popup2 button:not([aria-label]) {
                padding: 10px 16px !important;
                border-bottom: 1px solid rgba(226,232,240,.68) !important;
                background: transparent !important;
              }
              .mm-nearby-popup2 h4 {
                color: #0f172a !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                line-height: 1.25 !important;
              }
              .mm-nearby-popup2 p {
                color: #64748b !important;
                font-size: 11.5px !important;
                font-weight: 400 !important;
              }
              .mm-map2-pc-control {
                width: 54px !important;
                height: 54px !important;
                min-width: 54px !important;
                min-height: 54px !important;
                padding: 0 !important;
                border-radius: 999px !important;
                color: #2563eb !important;
                background: rgba(255,255,255,.96) !important;
                border: 1px solid rgba(226,232,240,.8) !important;
                box-shadow: 0 4px 10px rgba(15,23,42,.06), inset 0 1px 0 rgba(255,255,255,.9) !important;
                backdrop-filter: blur(18px) saturate(160%) !important;
                -webkit-backdrop-filter: blur(18px) saturate(160%) !important;
              }
              .mm-map2-pc-control-wide span,
              .mm-map2-pc-control-wide svg:last-child {
                display: none !important;
              }
              .mm-map2-pc-control.is-active,
              .mm-map2-pc-location-control.is-active {
                color: #fff !important;
                background: linear-gradient(180deg,#2f75ff 0%,#1d4ed8 100%) !important;
                border-color: rgba(37,99,235,.92) !important;
              }
              .mm-map2-category-menu-pc {
                position: absolute !important;
                top: 0 !important;
                right: calc(100% + 8px) !important;
                left: auto !important;
                width: min(320px, calc(100vw - 24px)) !important;
              }
              @media (min-width: 768px) {
                .mm-map2-category-menu:not(.mm-map2-category-menu-pc) {
                  display: none !important;
                }
                .mm-weather-popup2,
                .mm-nearby-popup2,
                .mm-map2-category-menu {
                  width: 320px !important;
                  max-width: 320px !important;
                }
              }
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2,
              :is(.dark, [data-theme="dark"]) .mm-nearby-popup2,
              :is(.dark, [data-theme="dark"]) .mm-map2-category-menu {
                color: #e2e8f0 !important;
                background: radial-gradient(circle at 88% 8%, rgba(37,99,235,.08), transparent 34%), #020617 !important;
                border-color: rgba(96,165,250,.18) !important;
                box-shadow: 0 24px 64px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.06) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-head,
              :is(.dark, [data-theme="dark"]) .mm-map2-category-menu-head,
              :is(.dark, [data-theme="dark"]) .mm-nearby-popup2 > div:first-child {
                border-bottom-color: rgba(96,165,250,.16) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2 h3,
              :is(.dark, [data-theme="dark"]) .mm-map2-category-menu-head h3,
              :is(.dark, [data-theme="dark"]) .mm-nearby-popup2 h3,
              :is(.dark, [data-theme="dark"]) .mm-nearby-popup2 h4,
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-temp {
                color: #f8fafc !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-desc,
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-provider,
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-location,
              :is(.dark, [data-theme="dark"]) .mm-nearby-popup2 p {
                color: #94a3b8 !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-head-icon,
              :is(.dark, [data-theme="dark"]) .mm-map2-category-menu-head-icon {
                color: #93c5fd !important;
                background: rgba(30,64,175,.22) !important;
                border-color: rgba(96,165,250,.20) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-hero,
              :is(.dark, [data-theme="dark"]) .mm-weather-popup2-rec,
              :is(.dark, [data-theme="dark"]) .mm-map2-category-menu-grid button {
                color: #e2e8f0 !important;
                background: rgba(7,20,38,.88) !important;
                border-color: rgba(96,165,250,.14) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-map2-category-menu-grid button.is-active {
                color: #fff !important;
                background: linear-gradient(180deg,#2f75ff 0%,#1d4ed8 100%) !important;
                border-color: rgba(96,165,250,.38) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-nearby-popup2 button:not([aria-label]) {
                border-bottom-color: rgba(96,165,250,.12) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-nearby-popup2 button:not([aria-label]):hover {
                background: rgba(37,99,235,.08) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-map2-pc-control {
                color: #93c5fd !important;
                background: rgba(7,20,38,.92) !important;
                border-color: rgba(96,165,250,.22) !important;
                box-shadow: 0 8px 20px rgba(0,0,0,.26), inset 0 1px 0 rgba(255,255,255,.08) !important;
              }
              :is(.dark, [data-theme="dark"]) .mm-map2-pc-control.is-active,
              :is(.dark, [data-theme="dark"]) .mm-map2-pc-location-control.is-active {
                color: #fff !important;
                background: linear-gradient(180deg,#2f75ff 0%,#1d4ed8 100%) !important;
              }
              @media (min-width: 768px) {
                .mm-map2-top,
                .mm-map2-side-layer {
                  display: none !important;
                }
                .mm-map2-pc-overlay {
                  display: flex !important;
                  position: absolute !important;
                  top: 16px !important;
                  left: 24px !important;
                  z-index: 90 !important;
                  width: auto !important;
                  max-width: none !important;
                  pointer-events: none !important;
                  opacity: 1 !important;
                  visibility: visible !important;
                }
                .mm-map2-pc-overlay.is-panel-closed {
                  right: 24px !important;
                }
                .mm-map2-pc-overlay.is-panel-open {
                  right: 724px !important;
                }
                .mm-map2-pc-search-wrap {
                  display: block !important;
                  width: calc(100% - 76px) !important;
                  max-width: none !important;
                  pointer-events: auto !important;
                  opacity: 1 !important;
                  visibility: visible !important;
                }
                .mm-map2-pc-search,
                .mm-map2-pc-search-input {
                  display: block !important;
                  width: 100% !important;
                  opacity: 1 !important;
                  visibility: visible !important;
                }
                .mm-map2-pc-tools {
                  display: flex !important;
                  position: absolute !important;
                  top: 0 !important;
                  right: 0 !important;
                  width: 54px !important;
                  flex-direction: column !important;
                  gap: 8px !important;
                  align-items: center !important;
                  pointer-events: auto !important;
                  opacity: 1 !important;
                  visibility: visible !important;
                }
                .mm-map2-pc-category-anchor {
                  order: 1 !important;
                  margin-left: 0 !important;
                }
                .mm-map2-pc-weather-anchor {
                  order: 2 !important;
                }
                .mm-map2-pc-nearby-anchor {
                  order: 3 !important;
                }
                .mm-map2-pc-location-control {
                  order: 4 !important;
                }
              }
            `,
          }}
        />
    </>
  );
}
