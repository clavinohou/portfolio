import { XlsxViewer, useXlsxViewerController } from '@extend-ai/react-xlsx'

export default function SpreadsheetWorkbook({ href, loading, unavailable }) {
  const workbook = useXlsxViewerController({ src: href, readOnly: true })
  const { activeTabIndex, setActiveTabIndex, tabs } = workbook

  return (
    <>
      <div className="media-lightbox__viewport">
        <XlsxViewer
          controller={workbook}
          height="100%"
          rounded={false}
          showDefaultToolbar={false}
          loadingState={loading}
          errorState={unavailable}
        />
      </div>
      {tabs.length > 0 && (
        <div className="media-lightbox__footer">
          <span className="media-lightbox__counter" aria-live="polite">
            {activeTabIndex + 1} <span>/ {tabs.length}</span>
          </span>
          <div className="media-lightbox__filmstrip spreadsheet-tabs" role="group" aria-label="Workbook sheets">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                className={`media-lightbox__filmstrip-item${index === activeTabIndex ? ' is-active' : ''}`}
                aria-pressed={index === activeTabIndex}
                onClick={() => setActiveTabIndex(index)}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
