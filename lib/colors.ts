export function avatarClass(index: number) {
  const classes = [
    'bg-[#006d6d]',
    'bg-[#7C3AED]',
    'bg-[#2563EB]',
    'bg-[#059669]',
    'bg-[#DC2626]',
    'bg-[#D97706]',
    'bg-[#0891B2]',
    'bg-[#BE185D]',
  ]

  return classes[index % classes.length]
}