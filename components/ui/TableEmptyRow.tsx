type TableEmptyRowProps = {
  colSpan: number
  text: string
}

export default function TableEmptyRow({
  colSpan,
  text,
}: TableEmptyRowProps) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-6 py-10 text-center text-sm text-[#6B7280]"
      >
        {text}
      </td>
    </tr>
  )
}