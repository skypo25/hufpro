export function DirectoryListingSearchNotice({
  message,
  variant,
}: {
  message: string
  variant: 'info' | 'warning'
}) {
  return (
    <div
      role="status"
      className={`dir-listing-banner dir-listing-banner--${variant}`}
      data-directory-section="search-notice"
    >
      {message}
    </div>
  )
}
