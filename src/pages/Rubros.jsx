// src/pages/Rubros.jsx
import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// -- SubRubroItem: Componente para mostrar/editar cada sub rubro
const SubRubroItem = ({
  rubroId,
  sub,
  editingValue,
  setEditingValue,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}) => {
  return (
    <li className="bg-gray-50 p-2 rounded flex flex-col sm:flex-row sm:justify-between sm:items-center">
      {editingValue !== undefined ? (
        <>
          <input
            type="text"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            className="p-2 border rounded w-full sm:mr-2 mb-2 sm:mb-0"
          />
          <div className="flex space-x-2">
            <button
              onClick={onSave}
              className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
            >
              Guardar
            </button>
            <button
              onClick={onCancel}
              className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
            >
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="w-full">{sub.nombre}</span>
          <div className="flex space-x-2 mt-2 sm:mt-0">
            <button
              onClick={onEdit}
              className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
            >
              Editar
            </button>
            <button
              onClick={onDelete}
              className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
            >
              Eliminar
            </button>
          </div>
        </>
      )}
    </li>
  );
};

// -- RubroCard: Tarjeta para cada rubro, gestiona sus sub rubros
const RubroCard = ({
  rubro,
  editingValue,
  setEditingValue,
  onEdit,
  onSave,
  onCancel,
  onDelete,

  subRubrosInputs,
  setSubRubrosInputs,
  onAddSubRubro,

  editingSubRubros,
  setEditingSubRubros,
  onSaveSubRubro,
  onCancelSubRubro,

  openDeleteConfirmation,
}) => {
  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
        {editingValue !== undefined ? (
          // Editando el nombre del rubro
          <input
            type="text"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            className="p-2 border rounded flex-1 mb-2 sm:mb-0 sm:mr-2"
          />
        ) : (
          <h3 className="text-xl font-semibold">{rubro.nombre}</h3>
        )}
        <div className="flex space-x-2">
          {editingValue !== undefined ? (
            <>
              <button
                onClick={() => onSave(rubro.id)}
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
              >
                Guardar
              </button>
              <button
                onClick={() => onCancel(rubro.id)}
                className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onEdit(rubro.id, rubro.nombre)}
                className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
              >
                Editar
              </button>
              <button
                onClick={() => openDeleteConfirmation("rubro", rubro.id)}
                className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sección de Sub Rubros */}
      <div className="mt-4">
        <h4 className="text-lg font-medium mb-2">Sub Rubros</h4>
        {rubro.subRubros?.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay sub rubros.</p>
        ) : (
          <ul className="space-y-2">
            {rubro.subRubros.map((sub) => {
              // editingSubRubros[rubroId][sub.id] => string (nuevo valor) o undefined
              const editingSub =
                editingSubRubros[rubro.id] &&
                editingSubRubros[rubro.id][sub.id] !== undefined
                  ? editingSubRubros[rubro.id][sub.id]
                  : undefined;

              return (
                <SubRubroItem
                  key={sub.id}
                  rubroId={rubro.id}
                  sub={sub}
                  editingValue={editingSub}
                  setEditingValue={(val) =>
                    setEditingSubRubros((prev) => ({
                      ...prev,
                      [rubro.id]: {
                        ...prev[rubro.id],
                        [sub.id]: val,
                      },
                    }))
                  }
                  onEdit={() => {
                    // Activar edición de ese sub rubro
                    setEditingSubRubros((prev) => ({
                      ...prev,
                      [rubro.id]: {
                        ...prev[rubro.id],
                        [sub.id]: sub.nombre,
                      },
                    }));
                  }}
                  onSave={() => {
                    // Guardar cambios en sub rubro
                    const newName = editingSubRubros[rubro.id][sub.id];
                    onSaveSubRubro(rubro.id, sub.id, newName);
                  }}
                  onCancel={() => onCancelSubRubro(rubro.id, sub.id)}
                  onDelete={() =>
                    openDeleteConfirmation("subRubro", rubro.id, sub.id)
                  }
                />
              );
            })}
          </ul>
        )}

        {/* Agregar nuevo Sub Rubro */}
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={subRubrosInputs[rubro.id] || ""}
            onChange={(e) =>
              setSubRubrosInputs((prev) => ({
                ...prev,
                [rubro.id]: e.target.value,
              }))
            }
            placeholder="Nuevo Sub Rubro"
            className="p-2 border rounded flex-1"
          />
          <button
            onClick={() => onAddSubRubro(rubro.id)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
};

const Rubros = () => {
  // Estado local de rubros (descargados de Firestore)
  const [rubros, setRubros] = useState([]);

  // Texto para agregar un rubro nuevo
  const [newRubro, setNewRubro] = useState("");

  // Texto para "nuevo sub rubro" por cada rubro => { rubroId: stringInput }
  const [subRubrosInputs, setSubRubrosInputs] = useState({});

  // Almacena { rubroId: "texto editing" } cuando se edita un rubro
  const [editingRubros, setEditingRubros] = useState({});
  // Almacena { rubroId: { subRubroId: "nuevo texto" } } cuando se edita un sub rubro
  const [editingSubRubros, setEditingSubRubros] = useState({});

  // Para confirmar eliminación
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    show: false,
    type: "", // 'rubro' o 'subRubro'
    rubroId: null,
    subRubroId: null,
  });

  // -----------------------------------------------------------------
  // 1) Cargar rubros desde Firestore al montar el componente
  // -----------------------------------------------------------------
  useEffect(() => {
    fetchRubros();
  }, []);

  async function fetchRubros() {
    try {
      const querySnapshot = await getDocs(collection(db, "rubros"));
      const loaded = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loaded.push({
          id: docSnap.id, // ID del documento en Firestore
          nombre: data.nombre,
          subRubros: data.subRubros || [],
        });
      });
      setRubros(loaded);
    } catch (error) {
      console.error("Error leyendo rubros desde Firestore:", error);
      alert("Hubo un problema al cargar los rubros de la base de datos.");
    }
  }

  // -----------------------------------------------------------------
  // 2) Agregar nuevo Rubro
  // -----------------------------------------------------------------
  const handleAddRubro = async () => {
    if (newRubro.trim()) {
      const rubroData = {
        nombre: newRubro.trim(),
        subRubros: [],
      };
      try {
        const docRef = await addDoc(collection(db, "rubros"), rubroData);
        // Actualizar estado local
        setRubros((prev) => [
          ...prev,
          { id: docRef.id, ...rubroData },
        ]);
        setNewRubro("");
      } catch (error) {
        console.error("Error agregando Rubro en Firestore:", error);
        alert("Hubo un problema al crear el Rubro en la base de datos.");
      }
    }
  };

  // -----------------------------------------------------------------
  // 3) Agregar nuevo Sub Rubro
  // -----------------------------------------------------------------
  const handleAddSubRubro = async (rubroId) => {
    const inputValue = subRubrosInputs[rubroId];
    if (inputValue && inputValue.trim()) {
      // Buscar el rubro en el estado local
      const rubroObj = rubros.find((r) => r.id === rubroId);
      if (!rubroObj) return;

      // Nuevo sub rubro
      const newSubRubro = {
        id: Date.now(), // Podrías usar un UUID
        nombre: inputValue.trim(),
      };
      const updatedSubRubros = [...rubroObj.subRubros, newSubRubro];

      // Actualizar en Firestore
      try {
        await updateDoc(doc(db, "rubros", rubroId), {
          subRubros: updatedSubRubros,
        });
        // Actualizar estado local
        setRubros((prev) =>
          prev.map((r) =>
            r.id === rubroId ? { ...r, subRubros: updatedSubRubros } : r
          )
        );
        setSubRubrosInputs((prev) => ({ ...prev, [rubroId]: "" }));
      } catch (error) {
        console.error("Error agregando sub rubro en Firestore:", error);
        alert("Hubo un problema al agregar el sub rubro en la base de datos.");
      }
    }
  };

  // -----------------------------------------------------------------
  // 4) Editar Rubro (nombre)
  // -----------------------------------------------------------------
  const handleEditRubro = (rubroId, currentName) => {
    setEditingRubros((prev) => ({ ...prev, [rubroId]: currentName }));
  };

  const handleSaveRubro = async (rubroId) => {
    const newName = editingRubros[rubroId];
    if (!newName.trim()) return;

    try {
      await updateDoc(doc(db, "rubros", rubroId), { nombre: newName.trim() });
      setRubros((prev) =>
        prev.map((r) => (r.id === rubroId ? { ...r, nombre: newName.trim() } : r))
      );
      setEditingRubros((prev) => {
        const newObj = { ...prev };
        delete newObj[rubroId];
        return newObj;
      });
    } catch (error) {
      console.error("Error editando Rubro en Firestore:", error);
      alert("Hubo un problema al editar el Rubro en la base de datos.");
    }
  };

  const handleCancelEditRubro = (rubroId) => {
    setEditingRubros((prev) => {
      const newObj = { ...prev };
      delete newObj[rubroId];
      return newObj;
    });
  };

  // -----------------------------------------------------------------
  // 5) Editar Sub Rubro
  // -----------------------------------------------------------------
  const handleSaveSubRubro = async (rubroId, subRubroId, newName) => {
    if (!newName.trim()) return;

    try {
      const rubroObj = rubros.find((r) => r.id === rubroId);
      if (!rubroObj) return;

      const updatedSubRubros = rubroObj.subRubros.map((s) =>
        String(s.id) === String(subRubroId)
          ? { ...s, nombre: newName.trim() }
          : s
      );

      await updateDoc(doc(db, "rubros", rubroId), {
        subRubros: updatedSubRubros,
      });

      setRubros((prev) =>
        prev.map((r) =>
          r.id === rubroId ? { ...r, subRubros: updatedSubRubros } : r
        )
      );

      // Quitar de editingSubRubros
      setEditingSubRubros((prev) => {
        const newObj = { ...prev };
        if (newObj[rubroId]) {
          delete newObj[rubroId][subRubroId];
          if (Object.keys(newObj[rubroId]).length === 0) {
            delete newObj[rubroId];
          }
        }
        return newObj;
      });
    } catch (error) {
      console.error("Error editando Sub Rubro en Firestore:", error);
      alert("Hubo un problema al editar el sub rubro en la base de datos.");
    }
  };

  const handleCancelEditSubRubro = (rubroId, subRubroId) => {
    setEditingSubRubros((prev) => {
      const newObj = { ...prev };
      if (newObj[rubroId]) {
        delete newObj[rubroId][subRubroId];
        if (Object.keys(newObj[rubroId]).length === 0) {
          delete newObj[rubroId];
        }
      }
      return newObj;
    });
  };

  // -----------------------------------------------------------------
  // 6) Eliminar Rubro o Sub Rubro (con confirmación)
  // -----------------------------------------------------------------
  const openDeleteConfirmation = (type, rubroId, subRubroId = null) => {
    setDeleteConfirmation({ show: true, type, rubroId, subRubroId });
  };

  const confirmDeletion = async () => {
    const { type, rubroId, subRubroId } = deleteConfirmation;
    if (type === "rubro") {
      // Eliminar todo el doc
      try {
        await deleteDoc(doc(db, "rubros", rubroId));
        setRubros((prev) => prev.filter((r) => r.id !== rubroId));
      } catch (error) {
        console.error("Error eliminando Rubro en Firestore:", error);
        alert("Hubo un problema al eliminar el Rubro en la base de datos.");
      }
    } else if (type === "subRubro") {
      // Quitar un sub rubro del array y actualizar doc
      const rubroObj = rubros.find((r) => r.id === rubroId);
      if (!rubroObj) return;
      const updatedSubRubros = rubroObj.subRubros.filter(
        (s) => String(s.id) !== String(subRubroId)
      );
      try {
        await updateDoc(doc(db, "rubros", rubroId), {
          subRubros: updatedSubRubros,
        });
        setRubros((prev) =>
          prev.map((r) =>
            r.id === rubroId ? { ...r, subRubros: updatedSubRubros } : r
          )
        );
      } catch (error) {
        console.error("Error eliminando Sub Rubro en Firestore:", error);
        alert("Hubo un problema al eliminar el Sub Rubro en la base de datos.");
      }
    }
    setDeleteConfirmation({ show: false, type: "", rubroId: null, subRubroId: null });
  };

  const cancelDeletion = () => {
    setDeleteConfirmation({ show: false, type: "", rubroId: null, subRubroId: null });
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-6">Administración de Rubros</h2>

      {/* Formulario para agregar Rubro */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <h3 className="text-xl font-semibold mb-3">Agregar Nuevo Rubro</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newRubro}
            onChange={(e) => setNewRubro(e.target.value)}
            placeholder="Nombre del Rubro"
            className="p-3 border rounded flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddRubro}
            className="bg-blue-600 text-white px-4 py-3 rounded hover:bg-blue-700 transition-colors"
          >
            Agregar
          </button>
        </div>
      </div>

      {/* Lista de Rubros */}
      {rubros.length === 0 ? (
        <p className="text-center text-gray-600">No hay rubros agregados.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rubros.map((rubro) => (
            <RubroCard
              key={rubro.id}
              rubro={rubro}
              editingValue={editingRubros[rubro.id]}
              setEditingValue={(val) =>
                setEditingRubros((prev) => ({ ...prev, [rubro.id]: val }))
              }
              onEdit={handleEditRubro}
              onSave={handleSaveRubro}
              onCancel={handleCancelEditRubro}
              onDelete={() => openDeleteConfirmation("rubro", rubro.id)}
              subRubrosInputs={subRubrosInputs}
              setSubRubrosInputs={setSubRubrosInputs}
              onAddSubRubro={handleAddSubRubro}
              editingSubRubros={editingSubRubros}
              setEditingSubRubros={setEditingSubRubros}
              onSaveSubRubro={handleSaveSubRubro}
              onCancelSubRubro={handleCancelEditSubRubro}
              openDeleteConfirmation={openDeleteConfirmation}
            />
          ))}
        </div>
      )}

      {/* Modal de confirmación (sin overlay de fondo) */}
      {deleteConfirmation.show && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white shadow-xl rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-2xl font-semibold mb-4">Confirmar Eliminación</h3>
            <p className="mb-6">
              ¿Estás seguro de que deseas eliminar este{" "}
              {deleteConfirmation.type === "rubro" ? "rubro" : "sub rubro"}?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={cancelDeletion}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeletion}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
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

export default Rubros;
