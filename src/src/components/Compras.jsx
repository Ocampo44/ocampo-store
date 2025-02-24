import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  addDoc,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import * as XLSX from "xlsx";

const Compras = () => {
  const [compras, setCompras] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Estados para filtros
  const [filterFechaInicio, setFilterFechaInicio] = useState("");
  const [filterFechaFin, setFilterFechaFin] = useState("");
  const [filterCodigoProducto, setFilterCodigoProducto] = useState("");
  const [filterEstadoCompra, setFilterEstadoCompra] = useState("");
  const [filterCuenta, setFilterCuenta] = useState("");
  const [filterReclamo, setFilterReclamo] = useState("");
  const [filterEstadoReclamo, setFilterEstadoReclamo] = useState("");

  // Estados para paginación y eliminación
  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = 20;
  const [compraToDelete, setCompraToDelete] = useState(null);

  // Referencia para el input file (para importar Excel)
  const fileInputRef = useRef(null);

  // Suscripción en tiempo real a la colección "compras"
  useEffect(() => {
    const q = query(collection(db, "compras"), orderBy("fecha", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const comprasList = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setCompras(comprasList);
      },
      (error) => {
        console.error("Error al obtener compras en tiempo real:", error);
        alert("Error al cargar compras desde la base de datos.");
      }
    );
    return () => unsubscribe();
  }, []);

  // Suscripción a la colección "almacenes" para obtener el nombre del almacén
  useEffect(() => {
    const q = query(collection(db, "almacenes"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const whArray = [];
      snapshot.forEach((docSnap) => {
        whArray.push({ id: docSnap.id, ...docSnap.data() });
      });
      setWarehouses(whArray);
    });
    return () => unsubscribe();
  }, []);

  // Filtrado de compras según los filtros establecidos
  const filteredCompras = compras.filter((compra) => {
    if (filterFechaInicio) {
      const fechaCompra = new Date(compra.fecha).toISOString().split("T")[0];
      if (fechaCompra < filterFechaInicio) return false;
    }
    if (filterFechaFin) {
      const fechaCompra = new Date(compra.fecha).toISOString().split("T")[0];
      if (fechaCompra > filterFechaFin) return false;
    }
    if (filterCodigoProducto) {
      const valorBuscado = filterCodigoProducto.toLowerCase();
      if (
        !compra.codigo?.toLowerCase().includes(valorBuscado) &&
        !compra.nombre?.toLowerCase().includes(valorBuscado)
      )
        return false;
    }
    if (filterEstadoCompra) {
      if (
        !compra.estado ||
        compra.estado.toLowerCase() !== filterEstadoCompra.toLowerCase()
      )
        return false;
    }
    if (filterCuenta) {
      if (!compra.cuenta?.toLowerCase().includes(filterCuenta.toLowerCase()))
        return false;
    }
    if (filterReclamo) {
      if (
        !compra.reclamo ||
        compra.reclamo.toLowerCase() !== filterReclamo.toLowerCase()
      )
        return false;
    }
    if (filterEstadoReclamo) {
      if (
        !compra.estadoReclamo ||
        compra.estadoReclamo.toLowerCase() !== filterEstadoReclamo.toLowerCase()
      )
        return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredCompras.length / rowsPerPage);
  const currentCompras = filteredCompras.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage
  );

  const goToPreviousPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
  };

  const confirmDelete = (compraId) => {
    setCompraToDelete(compraId);
  };

  const handleConfirmDelete = async () => {
    if (!compraToDelete) return;
    try {
      await deleteDoc(doc(db, "compras", compraToDelete));
      setCompraToDelete(null);
    } catch (error) {
      console.error("Error eliminando compra:", error);
      alert("Error al eliminar la compra: " + error.message);
    }
  };

  const handleCancelDelete = () => {
    setCompraToDelete(null);
  };

  // Función para exportar las compras filtradas a un archivo Excel
  const handleExport = () => {
    const dataToExport = filteredCompras.map((c) => ({
      fecha: new Date(c.fecha).toLocaleString(),
      comprobante: c.comprobante,
      codigo: c.codigo,
      nombre: c.nombre,
      cantidad: c.cantidad,
      estado: c.estado,
      estadoReclamo: c.estadoReclamo,
      almacenDestino:
        warehouses.find((w) => w.id === c.almacenDestino)?.nombre ||
        c.almacenDestino ||
        "",
      cuenta: c.cuenta,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Compras");
    XLSX.writeFile(workbook, "compras.xlsx");
  };

  // Función para importar compras desde un archivo Excel
  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const binaryStr = evt.target.result;
      const workbook = XLSX.read(binaryStr, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (jsonData.length < 2) {
        alert("El archivo no contiene datos.");
        return;
      }

      // Se asume que la primera fila es el header y se define un mapeo ampliado
      const header = jsonData[0];
      const headerMapping = {
        "número de pedido": "numeroPedido",
        "almacén destino": "almacenDestino",
        "código": "codigo",
        "cantidad": "cantidad",
        "costo total": "costoTotal",
        "nombre": "nombre",
        "guias": "guias",
        "motivo reclamo": "motivoReclamo",
        "monto reclamo": "montoReclamo",
        "estado reclamo": "estadoReclamo",
        "proveedor": "proveedor",
        "nombre proveedor": "nombreProveedor",
        "personal proveedor": "personalProveedor",
        "personal del proveedor": "personalDelProveedor",
        "personal compra": "personalCompra",
        "personal de compra": "personalDeCompra",
        "número de operación": "numeroOperacion",
        "observaciones": "observaciones",
      };

      // Normalizamos el header a minúsculas y sin espacios extra
      const normalizedHeader = header.map((h) =>
        h.toString().trim().toLowerCase()
      );

      // Verificamos que existan los campos obligatorios usando el mapeo
      const requiredFields = [
        "numeroPedido",
        "almacenDestino",
        "codigo",
        "cantidad",
        "costoTotal",
      ];
      const missingFields = requiredFields.filter(
        (field) =>
          !normalizedHeader.includes(
            Object.keys(headerMapping).find(
              (key) => headerMapping[key] === field
            )
          )
      );
      if (missingFields.length > 0) {
        alert(
          "El archivo Excel no contiene los campos obligatorios: " +
            missingFields.join(", ")
        );
        return;
      }

      // Convertir cada fila en un objeto usando el mapeo
      const dataToImport = jsonData.slice(1).map((row) => {
        let rowData = {};
        normalizedHeader.forEach((normField, index) => {
          const mappedField = headerMapping[normField];
          if (mappedField) {
            rowData[mappedField] = row[index];
          } else {
            // Si no está mapeado, se conserva con el nombre original
            rowData[header[index]] = row[index];
          }
        });
        return rowData;
      });

      // Validar que cada fila tenga los campos obligatorios completos
      const invalidRows = dataToImport.filter((row) =>
        requiredFields.some(
          (field) => !row[field] || row[field].toString().trim() === ""
        )
      );
      if (invalidRows.length > 0) {
        alert("Algunas filas no tienen los campos obligatorios.");
        return;
      }

      // Procesar cada fila e importar a Firestore
      try {
        for (const data of dataToImport) {
          // Si "nombre" está vacío, se consulta la colección "productos" para completarlo
          if (!data.nombre || data.nombre.toString().trim() === "") {
            const prodQuery = query(
              collection(db, "productos"),
              where("codigoProducto", "==", data.codigo)
            );
            const prodSnapshot = await getDocs(prodQuery);
            if (!prodSnapshot.empty) {
              data.nombre = prodSnapshot.docs[0].data().nombreProducto;
            }
          }
          // Si "comprobante" está vacío, lo autocompletamos (por ejemplo, con el número de pedido)
          if (!data.comprobante || data.comprobante.toString().trim() === "") {
            data.comprobante = data.numeroPedido;
          }
          // Si "estado" (Estado Compra) está vacío, se asigna un valor por defecto
          if (!data.estado || data.estado.toString().trim() === "") {
            data.estado = "Pendiente de envío";
          }
          // Agregar fecha actual si no se proporciona
          if (!data.fecha) {
            data.fecha = new Date().toISOString();
          }
          // Agregar otros campos por defecto si no existen en el Excel
          data.guias = data.guias || [];
          data.estadoReclamo = data.estadoReclamo || "Sin reclamo";
          data.motivoReclamo = data.motivoReclamo || "";
          data.montoReclamo = data.montoReclamo || "";
          data.proveedor = data.proveedor || "";
          data.nombreProveedor = data.nombreProveedor || "";
          data.personalProveedor = data.personalProveedor || "";
          data.personalDelProveedor = data.personalDelProveedor || "";
          data.personalCompra = data.personalCompra || "";
          data.personalDeCompra = data.personalDeCompra || "";
          data.numeroOperacion = data.numeroOperacion || "";
          data.observaciones = data.observaciones || "";
          
          await addDoc(collection(db, "compras"), data);
        }
        alert("Importación completada.");
      } catch (error) {
        console.error("Error al importar compras:", error);
        alert("Error al importar compras: " + error.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 text-black min-h-screen relative">
      <div className="p-4">
        {/* Encabezado con botones de Agregar, Importar y Exportar */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Compras</h1>
          <div className="flex gap-2">
            <Link
              to="/compras/agregar"
              className="bg-blue-500 hover:bg-blue-600 transition-colors text-white px-4 py-2 rounded shadow"
            >
              Agregar Compra
            </Link>
            <button
              onClick={() => fileInputRef.current.click()}
              className="bg-green-500 hover:bg-green-600 transition-colors text-white px-4 py-2 rounded shadow"
            >
              Importar
            </button>
            <button
              onClick={handleExport}
              className="bg-orange-500 hover:bg-orange-600 transition-colors text-white px-4 py-2 rounded shadow"
            >
              Exportar
            </button>
            {/* Input file oculto para la importación */}
            <input
              type="file"
              accept=".xlsx, .xls"
              ref={fileInputRef}
              onChange={handleFileImport}
              style={{ display: "none" }}
            />
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white shadow border border-blue-200 rounded p-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-2">
            <div>
              <label className="block text-sm font-semibold mb-1">
                Fecha Inicio
              </label>
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
              <label className="block text-sm font-semibold mb-1">
                Fecha Fin
              </label>
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
              <label className="block text-sm font-semibold mb-1">
                Código / Producto
              </label>
              <input
                type="text"
                value={filterCodigoProducto}
                onChange={(e) => {
                  setFilterCodigoProducto(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full p-1 border rounded text-sm"
                placeholder="Buscar por código o producto"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Estado Compra
              </label>
              <select
                value={filterEstadoCompra}
                onChange={(e) => {
                  setFilterEstadoCompra(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full p-1 border rounded text-sm"
              >
                <option value="">Todos</option>
                <option value="Por enviar">Por enviar</option>
                <option value="En camino">En camino</option>
                <option value="Parcialmente recibido">
                  Parcialmente recibido
                </option>
                <option value="Recibido">Recibido</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Cuenta
              </label>
              <input
                type="text"
                value={filterCuenta}
                onChange={(e) => {
                  setFilterCuenta(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full p-1 border rounded text-sm"
                placeholder="Buscar por cuenta"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Motivos de reclamo
              </label>
              <select
                value={filterReclamo}
                onChange={(e) => {
                  setFilterReclamo(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full p-1 border rounded text-sm"
              >
                <option value="">Todos</option>
                <option value="Pago rechazado">Pago rechazado</option>
                <option value="Sin envío">Sin envío</option>
                <option value="No entregado">No entregado</option>
                <option value="Entrega incompleta">Entrega incompleta</option>
                <option value="Plazo vencido">Plazo vencido</option>
                <option value="Producto distinto">Producto distinto</option>
                <option value="Producto dañado">Producto dañado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Estado Reclamo
              </label>
              <select
                value={filterEstadoReclamo}
                onChange={(e) => {
                  setFilterEstadoReclamo(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full p-1 border rounded text-sm"
              >
                <option value="">Todos</option>
                <option value="Sin reclamo">Sin reclamo</option>
                <option value="En curso">En curso</option>
                <option value="Reembolsado">Reembolsado</option>
                <option value="Sin reembolso">Sin reembolso</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabla de Compras */}
        <div className="bg-white shadow rounded border border-blue-500 overflow-auto w-full">
          <table className="w-full table-auto text-sm">
            <thead className="bg-blue-500">
              <tr>
                <th className="py-2 px-3 text-left text-white">Fecha</th>
                <th className="py-2 px-3 text-left text-white">Comprobante</th>
                <th className="py-2 px-3 text-left text-white">Código</th>
                <th className="py-2 px-3 text-left text-white">Producto</th>
                <th className="py-2 px-3 text-left text-white">Cantidad</th>
                <th className="py-2 px-3 text-left text-white">Estado Compra</th>
                <th className="py-2 px-3 text-left text-white">Estado Reclamo</th>
                <th className="py-2 px-3 text-left text-white">Almacén</th>
                <th className="py-2 px-3 text-left text-white">Cuenta</th>
                <th className="py-2 px-3 text-left text-white">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {currentCompras.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-3 text-center">
                    No hay compras registradas.
                  </td>
                </tr>
              ) : (
                currentCompras.map((compra, index) => (
                  <tr
                    key={compra.id}
                    className={`${
                      index % 2 === 0 ? "bg-gray-50" : "bg-white"
                    } hover:bg-indigo-100 transition-colors`}
                  >
                    <td className="py-2 px-3 border-b">
                      {new Date(compra.fecha).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 border-b">{compra.comprobante || ""}</td>
                    <td className="py-2 px-3 border-b">{compra.codigo || ""}</td>
                    <td className="py-2 px-3 border-b">{compra.nombre || ""}</td>
                    <td className="py-2 px-3 border-b">{compra.cantidad || ""}</td>
                    <td className="py-2 px-3 border-b">{compra.estado || ""}</td>
                    <td className="py-2 px-3 border-b">{compra.estadoReclamo || ""}</td>
                    <td className="py-2 px-3 border-b">
                      {warehouses.find((w) => w.id === compra.almacenDestino)?.nombre ||
                        compra.almacenDestino ||
                        ""}
                    </td>
                    <td className="py-2 px-3 border-b">{compra.cuenta || ""}</td>
                    <td className="py-2 px-3 border-b">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/compras/editar/${compra.id}`}
                          className="text-black hover:text-gray-700"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 7.5-7.5z"
                            />
                          </svg>
                        </Link>
                        <button
                          onClick={() => confirmDelete(compra.id)}
                          disabled={!!compraToDelete}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4"
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
        {filteredCompras.length > 0 && (
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

      {/* Modal de confirmación para eliminar compra */}
      {compraToDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-11/12 max-w-md shadow-lg">
            <h2 className="text-xl font-bold mb-4">Confirmar Eliminación</h2>
            <p className="mb-6">
              ¿Estás seguro de que deseas eliminar esta compra?
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

export default Compras;
