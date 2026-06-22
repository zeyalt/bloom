"use client";

import { useEffect, useState } from "react";
import { Plus, Download } from "lucide-react";
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
  institution: string;
  child_id: string;
  category_id: string;
}

const EMPTY_FORM = {
  child_id: "",
  category_id: "",
  activity_id: "",
  institution: "",
  description: "",
  amount: "",
  payment_date: new Date().toISOString().split('T')[0],
  paid_by: "",
  receipt_notes: "",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  // Get activities matching selected child and category
  const matchingActivities = activities.filter(
    a => (!form.child_id || a.child_id === form.child_id) &&
         (!form.category_id || a.category_id === form.category_id)
  );

  async function save() {
    if (!form.child_id || !form.category_id || !form.institution.trim() || !form.amount || !form.payment_date) {
      setError("Child, category, institution, amount, and date are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const year = new Date(form.payment_date).getFullYear();
      const payload = {
        child_id: form.child_id,
        category_id: form.category_id,
        activity_id: form.activity_id || null,
        institution: form.institution.trim(),
        description: form.description || null,
        amount: parseFloat(form.amount),
        payment_date: form.payment_date,
        paid_by: form.paid_by || null,
        year: year,
        receipt_notes: form.receipt_notes || null,
      };
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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
              <option value="">All children</option>
              {children.map(c => (
                <option key={c.id} value={c.id}>
                  {c.avatar_emoji} {c.name}
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Child</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Institution</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Category</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Paid by</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => (
                  <tr
                    key={exp.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(exp.payment_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {exp.child && (
                          <>
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: exp.child.color_code }}
                            />
                            <span className="text-[var(--text-primary)]">
                              {exp.child.avatar_emoji} {exp.child.name}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">{exp.institution}</td>
                    <td className="px-4 py-3">
                      {exp.category && (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${exp.category.color_code}15`,
                            color: exp.category.color_code,
                          }}
                        >
                          {exp.category.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{exp.paid_by || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add expense modal */}
        <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Expense">
          <div className="space-y-5">
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            {/* Child & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Child <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.child_id}
                  onChange={e => setForm(f => ({ ...f, child_id: e.target.value, institution: "" }))}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
                >
                  <option value="">Select child</option>
                  {children.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.avatar_emoji} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.category_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value, institution: "" }))}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
                >
                  <option value="">Select category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Institution */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                Institution <span className="text-red-500">*</span>
              </label>
              <select
                value={form.institution}
                onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
              >
                <option value="">Select institution</option>
                {matchingActivities.map(a => (
                  <option key={a.id} value={a.institution}>
                    {a.institution}
                  </option>
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
                placeholder="e.g. Monthly fee, Registration"
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
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.payment_date}
                  onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
                />
              </div>
            </div>

            {/* Paid by */}
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
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Receipt notes */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                Receipt notes
              </label>
              <textarea
                value={form.receipt_notes}
                onChange={e => setForm(f => ({ ...f, receipt_notes: e.target.value }))}
                placeholder="Any notes about the payment..."
                rows={2}
                className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={save} loading={saving}>
                Add Expense
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
