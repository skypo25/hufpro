'use client'

import { faPaw } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

/** Gleiches Pfoten-Icon wie in der Verzeichnis-Suchleiste (`DirectoryListingSearchStrip`). */
export function ProfileBentoPawIcon() {
  return <FontAwesomeIcon icon={faPaw} className="dir-prof-v2-bc-fa" aria-hidden />
}
