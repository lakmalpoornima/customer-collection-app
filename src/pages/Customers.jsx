import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  RotateCcw,
  Users,
  X,
} from "lucide-react";

import { db } from "../database/db";
import "../styles/cust.css";


const emptyForm = {
  name: "",
  phone: "",
  address: "",
  monthlyAmount: "",
  startDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

function Customers() {
  const [search, setSearch] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const customers =
    useLiveQuery(
      () =>
        db.customers
          .where("status")
          .equals(showRemoved ? "removed" : "active")
          .reverse()
          .sortBy("createdAt"),
      [showRemoved]
    ) || [];

  const filteredCustomers = customers.filter((customer) => {
    const value = search.toLowerCase();

    return (
      customer.name.toLowerCase().includes(value) ||
      customer.phone.includes(value) ||
      String(customer.id).includes(value)
    );
  });

  const formatCustomerCode = (id) =>
    `CUS${String(id).padStart(5, "0")}`;

  const formatCurrency = (amount) =>
    `Rs. ${Number(amount || 0).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const openNewForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (customer) => {
    setEditingId(customer.id);

    setForm({
      name: customer.name,
      phone: customer.phone,
      address: customer.address || "",
      monthlyAmount: customer.monthlyAmount,
      startDate: customer.startDate || "",
      notes: customer.notes || "",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };


  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const saveCustomer = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Please enter customer name.");
      return;
    }

    if (!form.phone.trim()) {
      alert("Please enter phone number.");
      return;
    }

    if (Number(form.monthlyAmount) < 0) {
      alert("Monthly amount cannot be negative.");
      return;
    }

    const now = new Date().toISOString();

    const customerData = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      monthlyAmount: Number(form.monthlyAmount || 0),
      startDate: form.startDate,
      notes: form.notes.trim(),
      updatedAt: now,
    };

    try {
      if (editingId) {
        await db.customers.update(editingId, customerData);
      } else {
        await db.customers.add({
          ...customerData,
          status: "active",
          createdAt: now,
        });
      }

      closeForm();
    } catch (error) {
      console.error("Customer save error:", error);
      alert("Unable to save customer.");
    }
  };

  const removeCustomer = async (customer) => {
    const confirmed = window.confirm(
      `Remove ${customer.name} from active customers?`
    );

    if (!confirmed) return;

    await db.customers.update(customer.id, {
      status: "removed",
      updatedAt: new Date().toISOString(),
    });
  };

  const restoreCustomer = async (customer) => {
    await db.customers.update(customer.id, {
      status: "active",
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="customers-page">
      <div className="customers-header">
        <div>
          <h1>Customers</h1>
          <p>Manage your customer details and monthly agreements.</p>
        </div>

        {!showRemoved && (
          <button className="primary-btn" onClick={openNewForm}>
            <Plus size={18} />
            Add Customer
          </button>
        )}
      </div>

      <div className="customer-toolbar">
        <div className="customer-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name, phone or customer code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          className={`filter-btn ${showRemoved ? "selected" : ""}`}
          onClick={() => setShowRemoved(!showRemoved)}
        >
          {showRemoved ? "Show Active Customers" : "Show Removed Customers"}
        </button>
      </div>

      <div className="customer-summary">
        <div className="summary-icon">
          <Users size={22} />
        </div>
        <div>
          <span>{showRemoved ? "Removed Customers" : "Active Customers"}</span>
          <strong>{customers.length}</strong>
        </div>
      </div>

      <div className="customer-table-container">
        <table className="customer-table">
          <thead>
            <tr>
              <th>Customer Code</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Monthly Amount</th>
              <th>Start Date</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredCustomers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <span className="customer-code">
                    {formatCustomerCode(customer.id)}
                  </span>
                </td>

                <td>
                  <strong>{customer.name}</strong>
                  {customer.address && (
                    <small>{customer.address}</small>
                  )}
                </td>

                <td>{customer.phone}</td>

                <td className="amount-cell">
                  {formatCurrency(customer.monthlyAmount)}
                </td>

                <td>{customer.startDate || "-"}</td>

                <td>
                  <div className="action-buttons">
                    {showRemoved ? (
                      <button
                        className="icon-btn restore-btn"
                        title="Restore customer"
                        onClick={() => restoreCustomer(customer)}
                      >
                        <RotateCcw size={17} />
                      </button>
                    ) : (
                      <>
                        <button
                          className="icon-btn edit-btn"
                          title="Edit customer"
                          onClick={() => openEditForm(customer)}
                        >
                          <Edit size={17} />
                        </button>

                        <button
                          className="icon-btn delete-btn"
                          title="Remove customer"
                          onClick={() => removeCustomer(customer)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan="6" className="empty-table">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="customer-modal">
            <div className="modal-header">
              <div>
                <h2>{editingId ? "Edit Customer" : "Add New Customer"}</h2>
                <p>Enter the customer's details below.</p>
              </div>

              <button className="close-btn" onClick={closeForm}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveCustomer}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Customer Name *</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Enter customer name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="07XXXXXXXX"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Monthly Amount (LKR)</label>
                  <input
                    type="number"
                    name="monthlyAmount"
                    value={form.monthlyAmount}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="form-group">
                  <label>Agreement Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    value={form.startDate}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Address</label>
                  <input
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Enter address"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    placeholder="Additional information..."
                    rows="3"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={closeForm}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-btn">
                  {editingId ? "Update Customer" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;