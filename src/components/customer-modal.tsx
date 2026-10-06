"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui"
import { Input } from "@/components/ui/input"
import { Modal, Field } from "@/components/ui/modal"

export interface NewCustomerInput {
  name: string
  phone: string
  city?: string
  state?: string
}

/**
 * Quick "name + phone" customer capture — used by Billing and Customers.
 */
export function NewCustomerModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (input: NewCustomerInput) => void
}) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")

  function submit() {
    if (!name.trim()) return
    onCreate({ name: name.trim(), phone: phone.trim(), city: city.trim() || undefined })
    setName("")
    setPhone("")
    setCity("")
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add customer"
      subtitle="Name and phone are enough to start"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            <Check className="h-4 w-4" /> Add customer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Traders" autoFocus />
        </Field>
        <Field label="Phone" hint="Used for WhatsApp bill sharing">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91-98xxx xxxxx" />
        </Field>
        <Field label="City">
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" />
        </Field>
      </div>
    </Modal>
  )
}
