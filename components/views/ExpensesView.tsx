"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Pencil, Trash2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatDate, formatCurrency } from "@/lib/utils";
import { getCurrentYear } from "@/lib/utils";
import { exportExpensesCSV } from "@/lib/export-csv";
import { PAYERS, EXPENSE_TYPES, EXPENSE_TYPE_COLORS, inferExpenseType } from "@/lib/constants";
import { Badge } from "@/components/ui/Badge";
import { SingleSelect } from "@/components/ui/FilterDropdown";
import { FilterBar, FilterField } from "@/components/ui/FilterBar";
import { ChildFilter } from "@/components/ui/ChildFilter";
import { useExpenses, useChildren, useActivities } from "@/lib/api-hooks";
import type { Expense, Activity } from "@/lib/types";

type ExpenseWithDetails = Expense;

const EMPTY_FORM = {
  child_id: "",
  activity_name: "",
  institution: "",
  description: "",
  amount: "",
  payment_date: new Date().toISOString().split('T')[0],
  paid_by: "Zeya",
  num_lessons: "",
  expense_type: "Lesson",
};

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const childrenInit = useRef(false);
  const toggleChild = (id: string) => setSelectedChildren(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const [filterYear, setFilterYear] = useState(String(getCurrentYear()));
  const [filterPayer, setFilterPayer] = useState("");
  const [filterType, setFilterType] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<ExpenseWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Cached via React Query (fetch per-year; filter child/payer client-side for
  // instant tab switches). Refresh via invalidation after saves.
  const { data: yearExpenses = [], isLoading: loading } = useExpenses({ year: Number(filterYear), limit: 500 });
  const { data: children = [] } = useChildren();
  const { data: activities = [] } = useActivities();

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["expenses"] });

  // Select all children by default once they load; toggling a pill off hides that child.
  useEffect(() => {
    if (!childrenInit.current && children.length) {
      setSelectedChildren(children.map(c => c.id));
      childrenInit.current = true;
    }
  }, [children]);

  // Kept out of the render path so typing in the add/edit form doesn't re-filter
  // and re-total the year on every keystroke.
  const expenses = useMemo(
    () => (yearExpenses as ExpenseWithDetails[]).filter(e =>
      selectedChildren.includes(e.child_id) &&
      (!filterPayer || e.paid_by === filterPayer) &&
      (!filterType || (e.expense_type || "Lesson") === filterType)
    ),
    [yearExpenses, selectedChildren, filterPayer, filterType]
  );

  const total = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

  function openAdd() {
    setEditingId(null);
    setEditingActivityId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(exp: ExpenseWithDetails) {
    setEditingId(exp.id);
    setEditingActivityId(exp.activity_id ?? null);
    const act = activities.find(a => a.id === exp.activity_id);
    setForm({
      child_id: exp.child_id,
      activity_name: act ? (act.activity_name || act.institution) : "",
      institution: exp.institution || "",
      description: exp.description || "",
      amount: String(exp.amount),
      payment_date: exp.payment_date.slice(0, 10),
      paid_by: exp.paid_by || "Zeya",
      num_lessons: exp.num_lessons != null ? String(exp.num_lessons) : "",
      expense_type: exp.expense_type || "Lesson",
    });
    setError("");
    setShowForm(true);
  }

  // Activity → Institution resolution (institution is mapped from the activity).
  // Only active activities are selectable (excludes dropped/legacy records);
  // keep the activity of the expense being edited even if it's inactive.
  const actName = (a: Activity) => a.activity_name || a.institution;
  const childActivities = activities.filter(
    a => a.child_id === form.child_id && (a.status === "active" || a.id === editingActivityId)
  );
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
        num_lessons: form.num_lessons || null,
        expense_type: form.expense_type || "Lesson",
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
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense() {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/expenses/${confirmDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Delete failed");
      }
      setConfirmDelete(null);
      refresh();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => getCurrentYear() - i);

  function activityLabel(exp: ExpenseWithDetails) {
    const act = exp.activity || activities.find(a => a.id === exp.activity_id);
    return act?.activity_name || act?.institution || "—";
  }

  return (
    <div className="max-w-[1200px] mx-auto w-full">
      <Header title="Expenses" subtitle="Class fees" />

      <div className="px-5 md:px-8 pt-4 md:pt-6 pb-24 md:pb-8">
        <ChildFilter className="mb-3" children={children} selected={selectedChildren} onToggle={toggleChild} />
        <FilterBar stretch className="mb-4">
          <FilterField label="Year">
            <SingleSelect
              className="w-32"
              ariaLabel="Filter by year"
              value={filterYear}
              onChange={setFilterYear}
              options={years.map(y => ({ value: String(y), label: String(y) }))}
            />
          </FilterField>
          <FilterField label="Payer">
            <SingleSelect
              className="w-40"
              ariaLabel="Filter by payer"
              value={filterPayer}
              onChange={setFilterPayer}
              options={[
                { value: "", label: "All Payers" },
                ...PAYERS.map(p => ({ value: p, label: p })),
              ]}
            />
          </FilterField>
          <FilterField label="Type">
            <SingleSelect
              className="w-40"
              ariaLabel="Filter by expense type"
              value={filterType}
              onChange={setFilterType}
              options={[
                { value: "", label: "All Types" },
                ...EXPENSE_TYPES.map(t => ({ value: t, label: t })),
              ]}
            />
          </FilterField>
        </FilterBar>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mb-8 items-center justify-end">
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
                <tr className="border-b border-[var(--rule)] bg-[var(--bg-secondary)] text-[var(--ink-soft)]">
                  <th className="px-3 py-2 text-left font-semibold">Payment Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Child</th>
                  <th className="px-3 py-2 text-left font-semibold">Activity</th>
                  <th className="px-3 py-2 text-left font-semibold">Institution</th>
                  <th className="px-3 py-2 text-left font-semibold">Type</th>
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
                      <td className="px-3 py-2 text-[var(--text-primary)] whitespace-nowrap">{activityLabel(exp)}</td>
                      <td className="px-3 py-2 text-[var(--text-primary)]">{exp.institution || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge
                          label={exp.expense_type || "Lesson"}
                          color={EXPENSE_TYPE_COLORS[(exp.expense_type || "Lesson") as keyof typeof EXPENSE_TYPE_COLORS]}
                        />
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] max-w-[200px] truncate">{exp.description || "—"}</td>
                      <td className="px-3 py-2 font-medium text-[var(--text-primary)] text-right whitespace-nowrap">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] text-right whitespace-nowrap">{costPerLesson}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{exp.paid_by || "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            onClick={() => openEdit(exp)}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-primary)] transition-colors"
                            title="Edit expense"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => { setDeleteError(""); setConfirmDelete(exp); }}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-white hover:text-[var(--margin)] transition-colors"
                            title="Delete expense"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
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

            {/* Type & Description */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Type
                </label>
                <select
                  value={form.expense_type}
                  onChange={e => setForm(f => ({ ...f, expense_type: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
                >
                  {EXPENSE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => {
                    const description = e.target.value;
                    setForm(f => ({
                      ...f,
                      description,
                      expense_type: editingId ? f.expense_type : inferExpenseType(description),
                    }));
                  }}
                  placeholder="e.g. Term 2 fees, Registration"
                  className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
                />
              </div>
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

            {/* Number of lessons & Paid by */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  No. of Lessons
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
                  Paid By
                </label>
                <select
                  value={form.paid_by}
                  onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--border)] rounded-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-[#D4895C]/30 focus:border-[#D4895C] transition-all"
                >
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

        <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete expense?" size="sm">
          {deleteError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{deleteError}</p>}
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Delete the {confirmDelete ? formatCurrency(confirmDelete.amount) : ""}{" "}
            {confirmDelete ? activityLabel(confirmDelete) : ""} record
            {confirmDelete?.description ? ` (${confirmDelete.description})` : ""}?
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" className="flex-1" onClick={deleteExpense} loading={deleting}>Delete</Button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
