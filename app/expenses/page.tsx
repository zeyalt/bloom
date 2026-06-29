"use client";

import { useEffect, useState } from "react";
import { Plus, Download, Pencil } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatDate, formatCurrency } from "@/lib/utils";
import { getCurrentYear } from "@/lib/utils";
import { exportExpensesCSV } from "@/lib/export-csv";
import { PAYERS } from "@/lib/constants";
import type { Expense, Child, ActivityCategory } from "@/lib/types";

interface ExpenseWithDetails extends Expense {
  child?: Child;
  category?: ActivityCategory;
}

interface Activity {
  id: string;
  activity_name?: string | null;
  institution: string;
  child_id: string;
  category_id: string;
}

const EMPTY_FORM = {
  child_id: "",
  activity_name: "",
  institution: "",
  description: "",
  amount: "",
  payment_date: new Date().toISOString().split('T')[0],
  paid_by: "",
  term_start_date: "",
  term_end_date: "",
  num_lessons: "",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterChild, setFilterChild] = useState("");
  const [filterYear, setFilterYear] = useState(String(getCurrentYear()));
  const [filterPayer, setFilterPayer] = useState("");

  async function fetchAll() {
    setLoading(true);
    try {
      const [expRes, childRes, catRes, actRes] = await Promise.all([
        fetch(
          `/api/expenses?year=${filterYear}${filterChild ? `&child_id=${filterChild}` : ""}${filterPayer ? `&paid_by=${filterPayer}` : ""}`
        ).then(r => r.json()),
        fetch("/api/children").then(r => r.json()),
        fetch("/api/categories").then(r => r.json()),
        fetch("/api/activities").then(r => r.json()),
      ]);
      setExpenses(expRes.data || []);
      setChildren(Array.isArray(childRes) ? childRes : []);
      setCategories(Array.isArray(catRes) ? catRes : []);
      setActivities(Array.isArray(actRes) ? actRes : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, [filterChild, filterYear, filterPayer]);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(exp: ExpenseWithDetails) {
    setEditingId(exp.id);
    const act = activities.find(a => a.id === exp.activity_id);
    setForm({
      child_id: exp.child_id,
      activity_name: act ? (act.activity_name || act.institution) : "",
      institution: exp.institution || "",
      description: exp.description || "",
      amount: String(exp.amount),
      payment_date: exp.payment_date.slice(0, 10),
      paid_by: exp.paid_by || "",
      term_start_date: exp.term_start_date ? exp.term_start_date.slice(0, 10) : "",
      term_end_date: exp.term_end_date ? exp.term_end_date.slice(0, 10) : "",
      num_lessons: exp.num_lessons != null ? String(exp.num_lessons) : "",
    });
    setError("");
    setShowForm(true);
  }

  // Activity → Institution resolution (institution is mapped from the activity)
  const actName = (a: Activity) => a.activity_name || a.institution;
  const childActivities = activities.filter(a => a.child_id === form.child_id);
  const activityNames = [...new Set(childActivities.map(actName))];
  const institutionsForName = [
    ...new Set(childActivities.filter(a => actName(a) === form.activity_name).map(a => a.institution)),
  ];
  const resolvedActivity = childActivities.find(
    a => actName(a) === form.activity_name && a.institution === form.institution
  );

  function onChildChange(v: string) {
    setForm(f => ({ ...f, child_id: v, activity_name: "", institution: "" }));
  }
  function onActivityChange(name: string) {
    const insts = childActivities.filter(a => actName(a) === name).map(a => a.institution);
    setForm(f => ({ ...f, activity_name: name, institution: insts[0] ?? "" }));
  }

  async function save() {
    if (!form.child_id || !resolvedActivity || !form.amount || !form.payment_date) {
      setError("Child, activity, amount and date are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const year = new Date(form.payment_date).getFullYear();
      const payload = {
        child_id: form.child_id,
        category_id: resolvedActivity.category_id,
        activity_id: resolvedActivity.id,
        institution: resolvedActivity.institution,
        description: form.description || null,
        amount: parseFloat(form.amount),
        payment_date: form.payment_date,
        paid_by: form.paid_by || null,
        year: year,
        term_start_date: form.term_start_date || null,
        term_end_date: form.term_end_date || null,
        num_lessons: form.num_lessons || null,
      };
      const res = await fetch(
        editingId ? `/api/expenses/${editingId}` : "/api/expenses",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Save failed");
      }
      setShowForm(false);
      fetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => getCurrentYear() - i);

  return (
    <div className="max-w-[1200px] mx-auto w-full">
      <Header title="Expenses" subtitle="All payments and fees" />

      <div className="px-5 md:px-8 pt-4 md:pt-6">
        {/* Filters and actions - single row on desktop, wraps on mobile */}
        <div className="flex flex-wrap gap-2 mb-8 items-end">
          <div className="flex-1 min-w-[110px]">
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">Year</label>
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="w-full px-2.5 py-2 text-sm border border-[var(--border)] rounded-[8px] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 transition-all"
            >
              {years.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">Child</label>
            <select
              value={filterChild}
              onChange={e => setFilterChild(e.target.value)}
              className="w-full px-2.5 py-2 text-sm border border-[var(--border)] rounded-[8px] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 transition-all"
            >
              <option value="">All</option>
              {children.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">Payer</label>
            <select
              value={filterPayer}
              onChange={e => setFilterPayer(e.target.value)}
              className="w-full px-2.5 py-2 text-sm border border-[var(--border)] rounded-[8px] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 transition-all"
            >
              <option value="">All payers</option>
              {PAYERS.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button onClick={() => exportExpensesCSV(expenses, `expenses-${filterYear}.csv`)} variant="secondary" size="sm">
              <Download size={14} /> Export
            </Button>
            <Button variant="primary" onClick={openAdd} size="sm">
              <Plus size={14} /> Add
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-6 p-4 bg-[var(--bg-secondary)] rounded-lg">
          <div className="text-sm text-[var(--text-secondary)]">Total</div>
          <div className="text-2xl font-semibold text-[var(--text-primary)]">{formatCurrency(total)}</div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <p className="text-sm">No expenses</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] uppercase tracking-wide">
                  <th className="px-3 py-2 text-left font-semibold">Payment Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Child</th>
                  <th className="px-3 py-2 text-left font-semibold">Institution</th>
                  <th className="px-3 py-2 text-left font-semibold">Description</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 text-right font-semibold">Cost / lesson</th>
                  <th className="px-3 py-2 text-left font-semibold">Paid by</th>
                  <th className="px-3 py-2 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => {
                  const costPerLesson =
                    exp.num_lessons && exp.num_lessons > 0
                      ? formatCurrency(exp.amount / exp.num_lessons)
                      : "—";
                  return (
                    <tr
                      key={exp.id}
                      className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{formatDate(exp.payment_date)}</td>
                      <td className="px-3 py-2 text-[var(--text-primary)] whitespace-nowrap">{exp.child?.name || "—"}</td>
                      <td className="px-3 py-2 text-[var(--text-primary)]">{exp.institution || "—"}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] max-w-[200px] truncate">{exp.description || "—"}</td>
                      <td className="px-3 py-2 font-medium text-[var(--text-primary)] text-right whitespace-nowrap">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] text-right whitespace-nowrap">{costPerLesson}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{exp.paid_by || "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => openEdit(exp)}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)] transition-colors"
                          title="Edit expense"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Add expense modal */}
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Expense" : "Add Expense"}>
          <div className="space-y-5">
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            {/* Child & Activity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Child <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.child_id}
                  onChange={e => onChildChange(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
                >
                  <option value="">Select child</option>
                  {children.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Activity <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.activity_name}
                  onChange={e => onActivityChange(e.target.value)}
                  disabled={!form.child_id}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all disabled:opacity-60"
                >
                  <option value="">Select activity</option>
                  {activityNames.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Institution — filtered to the selected activity */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                Institution
              </label>
              <select
                value={form.institution}
                onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                disabled={!form.activity_name}
                className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all disabled:opacity-60"
              >
                <option value="">Select institution</option>
                {institutionsForName.map(inst => (
                  <option key={inst} value={inst}>{inst}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                Description
              </label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Term 2 fees, Registration"
                className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
              />
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.payment_date}
                  onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
                />
              </div>
            </div>

            {/* Term dates (optional) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Term start <span className="text-[var(--text-muted)]">(optional)</span>
                </label>
                <input
                  type="date"
                  value={form.term_start_date}
                  onChange={e => setForm(f => ({ ...f, term_start_date: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Term end <span className="text-[var(--text-muted)]">(optional)</span>
                </label>
                <input
                  type="date"
                  value={form.term_end_date}
                  onChange={e => setForm(f => ({ ...f, term_end_date: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
                />
              </div>
            </div>

            {/* Number of lessons & Paid by */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  No. of lessons <span className="text-[var(--text-muted)]">(optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.num_lessons}
                  onChange={e => setForm(f => ({ ...f, num_lessons: e.target.value }))}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Paid by
                </label>
                <select
                  value={form.paid_by}
                  onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
                >
                  <option value="">—</option>
                  {PAYERS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={save} loading={saving}>
                Confirm
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
