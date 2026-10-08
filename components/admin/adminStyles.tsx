/**
 * Gemeinsame Tailwind-Klassen für den internen Admin-Bereich
 * (gleicher Look wie Behandler-Dashboard: content-card, dashboard-serif).
 */
export const adminCardClass = 'content-card'

/** @deprecated Prefer PageHeader — kept for rare inline titles. */
export const adminPageTitleClass =
  'dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-foreground'

export const adminSectionTitleClass =
  'dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]'

export const adminMutedClass = 'text-[13px] text-text-secondary'

export const adminSectionHeaderClass =
  'flex items-center gap-2 border-b border-[#E5E2DC] px-[22px] py-[18px]'

export const adminBreadcrumbClass = 'text-[13px] text-text-secondary'
