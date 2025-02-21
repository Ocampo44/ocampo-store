import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

const Almacenes = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [warehouseToDelete, setWarehouseToDelete] = useState(null);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  async function fetchWarehouses() {
    try {
      const q = query(collection(db, "almacenes"), orderBy("createdAt", "asc"));
      const querySnapshot = await getDocs(q);
      const loaded = [];
      querySnapshot.forEach((docSnap) => {
        loaded.push({ id: docSnap.id, ...docSnap.data() });
      });
      setWarehouses(loaded);
    } catch (error) {
      console.error("Error leyendo los almacenes desde Firestore:", error);
      alert("Hubo un problema al cargar los almacenes de la base de datos.");
    }
  }

  const handleAddWarehouse = async () => {
    if (!newWarehouseName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, "almacenes"), {
        nombre: newWarehouseName.trim(),
        createdAt: serverTimestamp(),
      });
      setWarehouses((prev) => [
        ...prev,
        {
          id: docRef.id,
          nombre: newWarehouseName.trim(),
          createdAt: new Date(),
        },
      ]);
      setNewWarehouseName("");
    } catch (error) {
      console.error("Error agregando almacén en Firestore:", error);
      alert("Hubo un problema al crear el almacén en la base de datos.");
    }
  };

  const handleShowDeleteConfirmation = (warehouse) => {
    setWarehouseToDelete(warehouse);
  };

  const confirmDelete = async () => {
    if (!warehouseToDelete) return;
    try {
      await deleteDoc(doc(db, "almacenes", warehouseToDelete.id));
      setWarehouses((prev) =>
        prev.filter((w) => w.id !== warehouseToDelete.id)
      );
      setWarehouseToDelete(null);
    } catch (error) {
      console.error("Error eliminando almacén en Firestore:", error);
      alert("Hubo un problema al eliminar el almacén de la base de datos.");
    }
  };

  const cancelDelete = () => {
    setWarehouseToDelete(null);
  };

  const handleEditWarehouse = (warehouse) => {
    setEditingWarehouse(warehouse.id);
    setEditingName(warehouse.nombre);
  };

  const handleSaveEdit = async (id) => {
    if (!editingName.trim()) return;
    try {
      await updateDoc(doc(db, "almacenes", id), {
        nombre: editingName.trim(),
      });
      setWarehouses((prev) =>
        prev.map((w) => (w.id === id ? { ...w, nombre: editingName.trim() } : w))
      );
      setEditingWarehouse(null);
      setEditingName("");
    } catch (error) {
      console.error("Error editando almacén en Firestore:", error);
      alert("Hubo un problema al editar el almacén en la base de datos.");
    }
  };

  const handleCancelEdit = () => {
    setEditingWarehouse(null);
    setEditingName("");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-lg relative">
      <h1 className="text-3xl font-bold mb-6 text-center">Almacenes</h1>
      <div className="flex justify-center mb-6">
        <input
          type="text"
          placeholder="Nombre del almacén..."
          value={newWarehouseName}
          onChange={(e) => setNewWarehouseName(e.target.value)}
          className="border border-gray-300 rounded-l px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={handleAddWarehouse}
          className="bg-blue-500 text-white px-6 py-2 rounded-r hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          Agregar
        </button>
      </div>

      {warehouses.length === 0 ? (
        <p className="text-center text-gray-500">No hay almacenes registrados.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warehouses.map((warehouse) => (
            <div
              key={warehouse.id}
              className="border border-gray-200 rounded-lg p-4 shadow hover:shadow-xl transition"
            >
              <div className="mb-4">
                {editingWarehouse === warehouse.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                ) : (
                  <h2 className="text-xl font-semibold">{warehouse.nombre}</h2>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                {editingWarehouse === warehouse.id ? (
                  <>
                    <button
                      onClick={() => handleSaveEdit(warehouse.id)}
                      className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleEditWarehouse(warehouse)}
                      className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleShowDeleteConfirmation(warehouse)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {warehouseToDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-10">
          <div className="bg-white p-6 rounded shadow-md max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">Confirmar Eliminación</h2>
            <p className="mb-6">
              ¿Estás seguro de eliminar el almacén{" "}
              <span className="font-semibold">
                "{warehouseToDelete.nombre}"
              </span>
              ?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={cancelDelete}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Almacenes;
