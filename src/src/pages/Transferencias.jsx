import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Transferencias = () => {
  // Estados para almacenar la lista de transferencias y los filtros
  const [transferencias, setTransferencias] = useState([]);
  const [filterFechaInicio, setFilterFechaInicio] = useState("");
  const [filterFechaFin, setFilterFechaFin] = useState("");
  const [filterCodigo, setFilterCodigo] = useState("");
  const [filterNombre, setFilterNombre] = useState("");
  const [filterComprobante, setFilterComprobante] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = 20;
  const [transferToDelete, setTransferToDelete] = useState(null);

  // Al cargar el componente, se obtienen las transferencias de Firestore
  useEffect(() => {
    fetchTransferencias();
  }, []);

  // Función para obtener la lista de transferencias desde Firestore
  async function fetchTransferencias() {
    try {
      const querySnapshot = await getDocs(collection(db, "transferencias"));
      const transferList = [];
      querySnapshot.forEach((docSnap) => {
        transferList.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });
      // Ordena por fecha de forma descendente
      transferList.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      setTransferencias(transferList);
    } catch (error) {
      console.error("Error obteniendo transferencias de Firestore:", error);
      alert("Error al cargar transferencias desde la base de datos.");
    }
  }

  // Se invoca al hacer clic en "Eliminar"
  const confirmDelete = (transferId) => {
    setTransferToDelete(transferId);
  };

  // Al confirmar eliminación se elimina el documento en Firestore
  const handleConfirmDelete = async () => {
    if (!transferToDelete) return;
    try {
      console.log("Intentando eliminar documento con ID:", transferToDelete);
      await deleteDoc(doc(db, "transferencias", transferToDelete));
      console.log("Documento eliminado correctamente.");
      // Se vuelve a obtener la lista actualizada
      fetchTransferencias();
      setTransferToDelete(null);
    } catch (error) {
      console.error("Error eliminando transferencia:", error);
      alert("Hubo un problema al eliminar la transferencia: " + error.message);
    }
  };

  // Cancelar la eliminación
  const handleCancelDelete = () => {
    setTransferToDelete(null);
  };

  // Filtrado de transferencias según los criterios de búsqueda
  const filteredTransfers = transferencias.filter((t) => {
    if (filterFechaInicio) {
      const fechaTransfer = new Date(t.fecha).toISOString().split("T")[0];
      if (fechaTransfer < filterFechaInicio) return false;
    }
    if (filterFechaFin) {
      const fechaTransfer = new Date(t.fecha).toISOString().split("T")[0];
      if (fechaTransfer > filterFechaFin) return false;
    }
    if (filterCodigo) {
      const codeLower = filterCodigo.toLowerCase();
      const matchCodigo =
        (t.codigo && t.codigo.toLowerCase().includes(codeLower)) ||
        (t.items || []).some(
          (item) =>
            item.codigoProducto &&
            item.codigoProducto.toLowerCase().includes(codeLower)
        );
      if (!matchCodigo) return false;
    }
    if (filterNombre) {
      const nameLower = filterNombre.toLowerCase();
      const matchNombre =
        (t.nombre && t.nombre.toLowerCase().includes(nameLower)) ||
        (t.items || []).some(
          (item) =>
            item.nombreProducto &&
            item.nombreProducto.toLowerCase().includes(nameLower)
        );
      if (!matchNombre) return false;
    }
    if (filterComprobante) {
      if (!t.comprobante || !t.comprobante.toLowerCase().includes(filterComprobante.toLowerCase())) {
        return false;
      }
    }
    if (filterEstado) {
      if (!t.estado || t.estado.toLowerCase() !== filterEstado.toLowerCase()) {
        return false;
      }
    }
    return true;
  });

  // Paginación
  const totalPages = Math.ceil(filteredTransfers.length / rowsPerPage);
  const currentTransfers = filteredTransfers.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage
  );

  const goToPreviousPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 text-black min-h-screen relative">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Transferencias</h1>
          <Link
            to="/transferencias/agregar"
            className="bg-blue-500 hover:bg-blue-600 transition-colors text-white px-4 py-2 rounded shadow"
          >
            Agregar Transferencia
          </Link>
        </div>
        {/* Sección de filtros */}
        <div className="bg-white shadow border border-blue-200 rounded p-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2">
            <div>
              <label className="block text-sm font-semibold mb-1">Fecha Inicio</label>
              <input
                type="date"
                value={filterFechaInicio}
                onChange={(e) => {
                  setFilterFechaInicio(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full p-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Fecha Fin</label>
              <input
                type="date"
                value={filterFechaFin}
                onChange={(e) => {
                  setFilterFechaFin(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full p-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Código</label>
              <input
                type="text"
                value={filterCodigo}
                onChange={(e) => {
                  setFilterCodigo(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full p-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Nombre</label>
              <input
                type="text"
                value={filterNombre}
                onChange={(e) => {
                  setFilterNombre(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full p-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Comprobante</label>
              <input
                type="text"
                value={filterComprobante}
                onChange={(e) => {
                  setFilterComprobante(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full p-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Estado</label>
              <select
                value={filterEstado}
                onChange={(e) => {
                  setFilterEstado(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full p-1 border rounded text-sm"
              >
                <option value="">Todos</option>
                <option value="Recepcionado">Recepcionado</option>
                <option value="Recepcionado parcialmente">Recepcionado parcialmente</option>
                <option value="Pendiente de recepción">Pendiente de recepción</option>
              </select>
            </div>
          </div>
        </div>
        {/* Sección de tabla */}
        <div className="bg-white shadow rounded border border-blue-500 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-blue-500">
              <tr>
                <th className="py-2 px-3 text-left text-white">Comprobante</th>
                <th className="py-2 px-3 text-left text-white">Fecha</th>
                <th className="py-2 px-3 text-left text-white">Estado</th>
                <th className="py-2 px-3 text-left text-white">Observaciones</th>
                <th className="py-2 px-3 text-left text-white">Depósito Origen</th>
                <th className="py-2 px-3 text-left text-white">Depósito Destino</th>
                <th className="py-2 px-3 text-left text-white">Personal Registro</th>
                <th className="py-2 px-3 text-left text-white">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {currentTransfers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-3 text-center">
                    No hay transferencias registradas.
                  </td>
                </tr>
              ) : (
                currentTransfers.map((transf, index) => (
                  <tr
                    key={transf.id}
                    className={`${index % 2 === 0 ? "bg-gray-50" : "bg-white"} hover:bg-indigo-100 transition-colors`}
                  >
                    <td className="py-2 px-3 border-b">{transf.comprobante}</td>
                    <td className="py-2 px-3 border-b">{new Date(transf.fecha).toLocaleString()}</td>
                    <td className="py-2 px-3 border-b">{transf.estado}</td>
                    <td className="py-2 px-3 border-b">{transf.observaciones}</td>
                    <td className="py-2 px-3 border-b">{transf.depositoOrigen}</td>
                    <td className="py-2 px-3 border-b">{transf.depositoDestino}</td>
                    <td className="py-2 px-3 border-b">{transf.personalRegistro}</td>
                    <td className="py-2 px-3 border-b">
                      <div className="flex flex-row items-center gap-2">
                        {(transf.estado === "Pendiente de recepción" ||
                          transf.estado === "Recepcionado parcialmente") && (
                          <Link
                            to={`/transferencias/recepcionar/${transf.id}`}
                            className="bg-green-500 hover:bg-green-600 transition-colors text-white px-2 py-1 rounded text-xs shadow"
                          >
                            Recepcionar
                          </Link>
                        )}
                        <button
                          onClick={() => confirmDelete(transf.id)}
                          disabled={!!transferToDelete}
                          className="flex items-center gap-1 bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 transition-colors text-white px-3 py-2 rounded-full shadow-lg transform hover:scale-105 duration-200 text-xs font-bold"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4a2 2 0 012 2v2H8V5a2 2 0 012-2z"
                            />
                          </svg>
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Paginación */}
        {filteredTransfers.length > 0 && (
          <div className="flex justify-between items-center mt-2">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 0}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 text-sm"
            >
              Anterior
            </button>
            <span className="text-sm">
              Página {currentPage + 1} de {totalPages === 0 ? 1 : totalPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage >= totalPages - 1}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 text-sm"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
      {/* Modal para confirmar eliminación */}
      {transferToDelete !== null && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-11/12 max-w-md shadow-lg">
            <h2 className="text-xl font-bold mb-4">Confirmar Eliminación</h2>
            <p className="mb-6">
              ¿Estás seguro de que deseas eliminar esta transferencia?
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
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

export default Transferencias;
