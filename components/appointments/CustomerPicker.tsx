'use client'

import { useMemo } from 'react'
import type { AppointmentCustomer } from './types'
import { formatCustomerNumber, getInitials } from '@/lib/format'

type CustomerPickerProps = {
  customers: AppointmentCustomer[]
  selectedCustomerId: string
  searchTerm: string
  onSearchTermChange: (value: string) => void
  onSelectCustomer: (customerId: string) => void
  onResetCustomer: () => void
}

function getCustomerDetail(customer: AppointmentCustomer) {
  const stable = customer.stable_name || customer.stable_city || customer.city || ''
  return stable || 'Kein Stall hinterlegt'
}

export default function CustomerPicker({
  customers,
  selectedCustomerId,
  searchTerm,
  onSearchTermChange,
  onSelectCustomer,
  onResetCustomer,
}: CustomerPickerProps) {
  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) || null

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    if (!term) return []

    return customers
      .filter((customer) => {
        const haystack = [
          customer.name,
          customer.city,
          customer.stable_name,
          customer.stable_city,
          customer.customer_number != null ? String(customer.customer_number) : null,
          customer.customer_number != null ? formatCustomerNumber(customer.customer_number) : null,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return haystack.includes(term)
      })
      .slice(0, 8)
  }, [customers, searchTerm])

  if (selectedCustomer) {
    return (
      <div className="rounded-[12px] border-2 border-[#52b788] bg-[rgba(21,66,38,0.04)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#52b788] text-[13px] font-semibold text-white">
            {getInitials(selectedCustomer.name)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {selectedCustomer.customer_number != null && (
                <span className="tabular-nums text-[12px] font-medium text-[#6B7280]">
                  {formatCustomerNumber(selectedCustomer.customer_number)}
                </span>
              )}
              <div className="truncate text-[14px] font-semibold text-[#1B1F23]">
                {selectedCustomer.name || '-'}
              </div>
            </div>
            <div className="truncate text-[12px] text-[#6B7280]">
              {getCustomerDetail(selectedCustomer)}
            </div>
          </div>

          <button
            type="button"
            onClick={onResetCustomer}
            className="text-[12px] font-semibold text-[#52b788] hover:underline"
          >
            Ändern
          </button>
        </div>
      </div>
    )
  }

  const hasSearch = searchTerm.trim().length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5">
        <i className="bi bi-search text-[14px] text-[#9CA3AF]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          placeholder="Kunde suchen…"
          className="w-full border-0 bg-transparent text-[13px] text-[#1B1F23] outline-none placeholder:text-[#9CA3AF]"
        />
      </div>

      {hasSearch && (
        <div className="space-y-2">
          {filteredCustomers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => onSelectCustomer(customer.id)}
              className="flex w-full items-center gap-3 rounded-[10px] border border-[#E5E2DC] bg-white px-4 py-3 text-left transition hover:border-[#52b788] hover:bg-[rgba(21,66,38,0.02)]"
            >
              <div className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#52b788] text-[12px] font-semibold text-white">
                {getInitials(customer.name)}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {customer.customer_number != null && (
                    <span className="tabular-nums text-[12px] font-medium text-[#6B7280]">
                      {formatCustomerNumber(customer.customer_number)}
                    </span>
                  )}
                  <div className="truncate text-[14px] font-semibold text-[#1B1F23]">
                    {customer.name || '-'}
                  </div>
                </div>
                <div className="truncate text-[12px] text-[#6B7280]">
                  {getCustomerDetail(customer)}
                </div>
              </div>
            </button>
          ))}

          {filteredCustomers.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#E5E2DC] px-4 py-6 text-center text-[13px] text-[#6B7280]">
              Kein Kunde gefunden.
            </div>
          )}
        </div>
      )}
    </div>
  )
}