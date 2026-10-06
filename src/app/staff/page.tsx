"use client"

import { useMemo, useState } from "react"
import {
  Check,
  IndianRupee,
  Phone,
  Plus,
  UserCog,
} from "lucide-react"
import { useERP } from "@/lib/store"
import { useLanguage } from "@/lib/i18n"
import type { AttendanceStatus, Staff } from "@/types"
import { Button } from "@/components/ui"
import { Input } from "@/components/ui/input"
import { Modal, Field } from "@/components/ui/modal"
import { currentMonth, formatINR, prettyDate, todayISO } from "@/lib/erp/utils"
import { cn } from "@/lib/utils"

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

const AVATAR_TONES = [
  "from-[#0a84ff] to-[#64d2ff]",
  "from-[#ff9f0a] to-[#ffd60a]",
  "from-[#30d158] to-[#66d4cf]",
  "from-[#ff375f] to-[#ff9f0a]",
  "from-[#bf5af2] to-[#5e5ce6]",
]

export default function StaffPage() {
  const { state, setAttendance, paySalary, addStaff, notify } = useERP()
  const { t } = useLanguage()
  const [showAdd, setShowAdd] = useState(false)
  const today = todayISO()
  const month = currentMonth()

  const salaryPaidThisMonth = useMemo(() => {
    const paid = new Set(
      state.expenses
        .filter(
          (e) =>
            e.type === "EXPENSE" &&
            e.category === "Salary" &&
            e.date.startsWith(month)
        )
        .map((e) => e.staffId)
    )
    return paid
  }, [state.expenses, month])

  const attendanceToday = useMemo(() => {
    const map = new Map<string, AttendanceStatus>()
    state.attendance
      .filter((a) => a.date === today)
      .forEach((a) => map.set(a.staffId, a.status))
    return map
  }, [state.attendance, today])

  const stats = useMemo(() => {
    let present = 0
    let leave = 0
    let due = 0
    state.staff
      .filter((s) => s.active)
      .forEach((s) => {
        const st = attendanceToday.get(s.id)
        if (st === "PRESENT" || st === "HALF_DAY") present += 1
        if (st === "LEAVE") leave += 1
        if (!salaryPaidThisMonth.has(s.id)) due += s.monthlySalary
      })
    return { present, leave, due, headcount: state.staff.filter((s) => s.active).length }
  }, [state.staff, attendanceToday, salaryPaidThisMonth])

  return (
    <main className="min-h-screen bg-background antialiased">
      <section className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 fade-in-up">
            <div>
              <p className="eyebrow mb-3">Team</p>
              <h1 className="text-[34px] font-bold tracking-[-0.04em] md:text-[42px]">
                {t("staff.title")}
              </h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {t("staff.subtitle")}
              </p>
            </div>
            <Button size="lg" className="shadow-lg shadow-primary/25" onClick={() => setShowAdd(true)}>
              <Plus className="h-4.5 w-4.5" /> {t("staff.add")}
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 fade-in-up" style={{ animationDelay: "80ms" }}>
            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
              <p className="eyebrow">{t("staff.headcount")}</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums">{stats.headcount}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
              <p className="eyebrow">{t("staff.presentToday")}</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-[#30d158]">
                {stats.present}/{stats.headcount}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
              <p className="eyebrow">{t("staff.onLeave")}</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-[#ff9f0a]">
                {stats.leave}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
              <p className="eyebrow">{t("staff.salaryDue")}</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-[#ff453a]">
                {formatINR(stats.due)}
              </p>
            </div>
          </div>

          {/* Staff cards */}
          {state.staff.length === 0 ? (
            <div className="card-glow flex flex-col items-center rounded-[20px] border border-border/70 bg-card px-6 py-16 text-center shadow-[var(--shadow-1)]">
              <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <UserCog className="h-6 w-6" />
              </span>
              <p className="text-[15px] font-semibold">No staff added yet</p>
              <p className="mt-1 max-w-[360px] text-[13.5px] text-muted-foreground">
                Add your counter staff to mark daily attendance and track monthly salaries.
              </p>
              <Button className="mt-4" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" /> Add first staff
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {state.staff.map((member, idx) => (
                <StaffCard
                  key={member.id}
                  member={member}
                  index={idx}
                  month={month}
                  attendance={attendanceToday.get(member.id) ?? null}
                  salaryPaid={salaryPaidThisMonth.has(member.id)}
                  onAttendance={(status) =>
                    setAttendance(member.id, today, status)
                  }
                  onPay={() => {
                    paySalary(member.id, month)
                    notify(
                      `Salary ${formatINR(member.monthlySalary)} paid to ${member.name}`,
                      "success"
                    )
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <AddStaffModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreate={(input) => {
          const member = addStaff(input)
          notify(`${member.name} added to the team`, "success")
          setShowAdd(false)
        }}
      />
    </main>
  )
}

function StaffCard({
  member,
  index,
  month,
  attendance,
  salaryPaid,
  onAttendance,
  onPay,
}: {
  member: Staff
  index: number
  month: string
  attendance: AttendanceStatus | null
  salaryPaid: boolean
  onAttendance: (status: AttendanceStatus | null) => void
  onPay: () => void
}) {
  const { t } = useLanguage()
  const statusOptions = [
    { value: "PRESENT", label: t("staff.present") },
    { value: "HALF_DAY", label: t("staff.halfDay") },
    { value: "ABSENT", label: t("staff.absent") },
    { value: "LEAVE", label: t("staff.leave") },
  ] as const
  return (
    <div
      className="card-glow rounded-[20px] border border-border/70 bg-card p-5 shadow-[var(--shadow-1)] fade-in-up"
      style={{ animationDelay: `${120 + index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className={cn(
              "grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br text-[14px] font-bold text-white",
              AVATAR_TONES[index % AVATAR_TONES.length]
            )}
          >
            {initials(member.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15.5px] font-bold tracking-[-0.01em]">
              {member.name}
            </p>
            <p className="truncate text-[12.5px] text-muted-foreground">
              {member.role}
              {member.phone && (
                <>
                  {" · "}
                  <span className="tabular-nums">{member.phone}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-[15px] font-bold tabular-nums">
            {formatINR(member.monthlySalary)}
          </p>
          <p className="eyebrow">{t("staff.perMonth")}</p>
        </div>
      </div>

      {/* Attendance */}
      <div className="mt-4">
        <p className="eyebrow mb-2">{t("staff.attendance")} · {prettyDate(todayISO())}</p>
        <div className="segmented" role="radiogroup" aria-label={`Attendance for ${member.name}`}>
          {statusOptions.map((opt) => {
            const active = attendance === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                data-active={active}
                title={active ? `Clear ${opt.label.toLowerCase()}` : `Mark ${opt.label.toLowerCase()}`}
                onClick={() => onAttendance(active ? null : opt.value)}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Salary */}
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-background/60 px-4 py-3">
        <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <IndianRupee className="h-3.5 w-3.5" />
          {t("staff.salary")} · {prettyDate(`${month}-01`).slice(3)}
        </span>
        {salaryPaid ? (
          <span className="flex items-center gap-1.5 rounded-full bg-[#30d158]/12 px-3 py-1 text-[12.5px] font-bold text-[#30d158]">
            <Check className="h-3.5 w-3.5" strokeWidth={3} /> {t("staff.paid")}
          </span>
        ) : (
          <button
            type="button"
            onClick={onPay}
            className="rounded-full bg-primary px-3.5 py-1.5 text-[12.5px] font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:brightness-110 active:scale-95"
          >
            {t("staff.pay")} {formatINR(member.monthlySalary)}
          </button>
        )}
      </div>

      {!member.phone && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Phone className="h-3 w-3" /> No phone on file
        </p>
      )}
    </div>
  )
}

const ROLES = ["Sales", "Technician", "Service", "Accountant", "Helper", "Manager"]

function AddStaffModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (input: {
    name: string
    role: string
    phone: string
    monthlySalary: number
    joinedAt?: string
  }) => void
}) {
  const [name, setName] = useState("")
  const [role, setRole] = useState(ROLES[0])
  const [phone, setPhone] = useState("")
  const [salary, setSalary] = useState("")
  const { t } = useLanguage()

  function submit() {
    if (!name.trim()) return
    onCreate({
      name: name.trim(),
      role,
      phone: phone.trim(),
      monthlySalary: Math.round(Number(salary) || 0),
      joinedAt: todayISO(),
    })
    setName("")
    setPhone("")
    setSalary("")
    setRole(ROLES[0])
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("staff.add")}
      subtitle="Attendance and salary tracking start right away"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            <Check className="h-4 w-4" /> {t("staff.add")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("staff.name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ravi Kumar" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("staff.role")}>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-input/70 bg-background px-3 text-[14px] text-foreground outline-none transition-all hover:border-input focus-visible:border-ring"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("staff.phone")}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91-98xxx xxxxx" />
          </Field>
        </div>
        <Field label={t("staff.monthlySalary")} hint="Paid with one tap — auto-logged as an expense">
          <Input type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="18000" />
        </Field>
      </div>
    </Modal>
  )
}
