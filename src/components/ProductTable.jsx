// src/components/ProductTable.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  collection,
  onSnapshot,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// Normaliza strings a minúsculas y sin espacios sobrantes
const safeNormalize = (value) =>
  value !== undefined && value !== null ? String(value).trim().toLowerCase() : "";

const ProductTable = ({ rubros = [] }) => {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Filtros
  const [filterCodigo, setFilterCodigo] = useState("");
  const [filterNombre, setFilterNombre] = useState("");
  const [filterMl, setFilterMl] = useState("");
  const [filterAlmacen, setFilterAlmacen] = useState("");
  const [filterRubro, setFilterRubro] = useState("");
  const [filterSubRubro, setFilterSubRubro] = useState("");

  // Paginación
  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = 20;

  // Modal de confirmación de borrado
  const [productToDelete, setProductToDelete] = useState(null);

  const fileInputRef = useRef(null);

  // Suscribirse a productos y cargar almacenes al montar
  useEffect(() => {
    const unsubscribeProducts = onSnapshot(
      collection(db, "productos"),
      (snapshot) => {
        const productosFirestore = [];
        snapshot.forEach((docSnap) => {
          productosFirestore.push({
            id: docSnap.id,
            ...docSnap.data(),
          });
        });
        console.log("Productos Firestore actualizados: ", productosFirestore);
        setProducts(productosFirestore);
      },
      (error) => {
        console.error("Error leyendo productos en tiempo real:", error);
      }
    );

    // Cargar almacenes (lectura única)
    fetchWarehousesFromFirestore();

    return () => {
      unsubscribeProducts();
    };
  }, []);

  useEffect(() => {
    setFilterSubRubro("");
    setCurrentPage(0);
  }, [filterRubro]);

  useEffect(() => {
    if (warehouses.length > 0 && !filterAlmacen) {
      setFilterAlmacen(warehouses[0].id);
    }
  }, [warehouses, filterAlmacen]);

  async function fetchWarehousesFromFirestore() {
    try {
      const q = query(collection(db, "almacenes"), orderBy("createdAt", "asc"));
      const querySnapshot = await getDocs(q);
      const almacenArray = [];
      querySnapshot.forEach((docSnap) => {
        almacenArray.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });
      console.log("Almacenes Firestore (ordenados): ", almacenArray);
      setWarehouses(almacenArray);
    } catch (error) {
      console.error("Error obteniendo almacenes de Firestore:", error);
      alert("Error cargando almacenes de la base de datos.");
    }
  }

  async function handleDeleteProduct(productId) {
    try {
      await deleteDoc(doc(db, "productos", productId));
    } catch (error) {
      console.error("Error eliminando producto en Firestore:", error);
      alert("Hubo un error al eliminar el producto en la base de datos.");
    }
  }

  async function handleImportProducts(productArray) {
    try {
      for (let prod of productArray) {
        await addDoc(collection(db, "productos"), prod);
      }
      alert(`Importación exitosa de ${productArray.length} productos.`);
    } catch (error) {
      console.error("Error importando productos a Firestore:", error);
      alert("Hubo un error al importar productos en la base de datos.");
    }
  }

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(0);
  };

  const filteredProducts = products.filter((prod) => {
    const codigoStr = filterCodigo.trim().toLowerCase();
    const nombreStr = filterNombre.trim().toLowerCase();
    const mlStr = filterMl.trim().toLowerCase();

    const prodCodigo = safeNormalize(prod.codigoProducto);
    const prodBarras = safeNormalize(prod.codigoBarras);
    const prodNombre = safeNormalize(prod.nombreProducto);
    const prodMl = safeNormalize(prod.idMercadolibre);

    const matchesCodigo =
      prodCodigo.includes(codigoStr) || prodBarras.includes(codigoStr);
    const matchesNombre = prodNombre.includes(nombreStr);
    const matchesMl = prodMl.includes(mlStr);

    const matchesRubro = filterRubro
      ? String(prod.rubro) === String(filterRubro)
      : true;
    const matchesSubRubro = filterSubRubro
      ? String(prod.subRubro) === String(filterSubRubro)
      : true;

    return (
      matchesCodigo &&
      matchesNombre &&
      matchesMl &&
      matchesRubro &&
      matchesSubRubro
    );
  });

  const totalPages = Math.ceil(filteredProducts.length / rowsPerPage);
  const currentProducts = filteredProducts.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage
  );

  const goToPreviousPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
  };

  const handleExportExcel = () => {
    const dataToExport = filteredProducts.map(({ id, ...rest }) => rest);
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, "productos.xlsx");
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = (err) => {
      console.error("Error leyendo el archivo:", err);
      alert("Error leyendo el archivo.");
    };
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: "binary" });
        if (workbook.SheetNames.length === 0) {
          alert("El archivo no contiene hojas.");
          return;
        }
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (!jsonData || jsonData.length === 0) {
          alert("No se encontraron datos en el archivo.");
          return;
        }

        const invalidRows = jsonData.filter(
          (row) =>
            row["codigoProducto"] === undefined ||
            row["nombreProducto"] === undefined
        );
        if (invalidRows.length > 0) {
          alert(
            "El formato del Excel es incorrecto. Cada fila debe tener 'codigoProducto' y 'nombreProducto'."
          );
          return;
        }

        const productArray = jsonData.map((row) => ({
          codigoProducto: row.codigoProducto,
          nombreProducto: row.nombreProducto,
          codigoBarras: row.codigoBarras || "",
          idMercadolibre: row.idMercadolibre || "",
          rubro: row.rubro || "",
          subRubro: row.subRubro || "",
          almacenId: row.almacenId || "",
          stock: row.stock || 0,
        }));

        await handleImportProducts(productArray);

        setFilterCodigo("");
        setFilterNombre("");
        setFilterMl("");
        setFilterRubro("");
        setFilterSubRubro("");
        setCurrentPage(0);
      } catch (error) {
        console.error("Error al procesar el archivo:", error);
        alert("Error al procesar el archivo Excel.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const confirmDelete = (productId) => {
    if (!productToDelete) {
      setProductToDelete(productId);
    }
  };

  const handleConfirmDelete = () => {
    if (productToDelete) {
      handleDeleteProduct(productToDelete);
      setProductToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setProductToDelete(null);
  };

  const subRubrosOptions = filterRubro
    ? rubros.find((r) => String(r.id) === String(filterRubro))?.subRubros || []
    : [];

  const getRubroName = (prod) => {
    if (!prod.rubro) return "";
    const rubroFound = rubros.find((r) => String(r.id) === String(prod.rubro));
    return rubroFound ? rubroFound.nombre : prod.rubro;
  };

  const getSubRubroName = (prod) => {
    if (!prod.subRubro || !prod.rubro) return "";
    const rubroFound = rubros.find((r) => String(r.id) === String(prod.rubro));
    if (rubroFound) {
      const subFound = rubroFound.subRubros.find(
        (s) => String(s.id) === String(prod.subRubro)
      );
      return subFound ? subFound.nombre : prod.subRubro;
    }
    return prod.subRubro;
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 text-black min-h-screen">
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="flex-1 min-w-[120px]">
            <input
              id="filterCodigo"
              type="text"
              value={filterCodigo}
              onChange={handleFilterChange(setFilterCodigo)}
              placeholder="Código o Barras"
              className="w-full p-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-black text-sm"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <input
              id="filterNombre"
              type="text"
              value={filterNombre}
              onChange={handleFilterChange(setFilterNombre)}
              placeholder="Nombre"
              className="w-full p-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-black text-sm"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <input
              id="filterMl"
              type="text"
              value={filterMl}
              onChange={handleFilterChange(setFilterMl)}
              placeholder="ID ML"
              className="w-full p-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-black text-sm"
            />
          </div>
          <div className="flex-1 min-w-[100px]">
            <select
              id="filterAlmacen"
              value={filterAlmacen}
              onChange={handleFilterChange(setFilterAlmacen)}
              className="w-full p-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-black text-sm"
            >
              {warehouses.map((almacen) => (
                <option key={almacen.id} value={almacen.id}>
                  {almacen.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[100px]">
            <select
              id="filterRubro"
              value={filterRubro}
              onChange={handleFilterChange(setFilterRubro)}
              className="w-full p-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-black text-sm"
            >
              <option value="">Rubro</option>
              {rubros.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[100px]">
            <select
              id="filterSubRubro"
              value={filterSubRubro}
              onChange={handleFilterChange(setFilterSubRubro)}
              className="w-full p-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-black text-sm"
              disabled={!filterRubro}
            >
              <option value="">Sub Rubro</option>
              {subRubrosOptions.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={handleExportExcel}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1 rounded text-sm"
          >
            Exportar Excel
          </button>
          <button
            onClick={triggerFileInput}
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-1 rounded text-sm"
          >
            Importar Excel
          </button>
          <Link
            to="/productos/nuevo"
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-1 rounded text-center text-sm"
          >
            Agregar Producto
          </Link>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".xlsx, .xls"
            className="hidden"
          />
        </div>

        <div className="mt-4 bg-white shadow rounded border border-blue-500 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-blue-500">
              <tr>
                <th className="py-2 px-3 text-left text-black">Código</th>
                <th className="py-2 px-3 text-left text-black">Nombre</th>
                <th className="py-2 px-3 text-left text-black">Stock</th>
                <th className="py-2 px-3 text-left text-black">En transferencia</th>
                <th className="py-2 px-3 text-left text-black">Barras</th>
                <th className="py-2 px-3 text-left text-black">ID ML</th>
                <th className="py-2 px-3 text-left text-black">Rubro</th>
                <th className="py-2 px-3 text-left text-black">Sub Rubro</th>
                <th className="py-2 px-3 text-left text-black">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {currentProducts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-3 text-center text-black">
                    No hay productos disponibles.
                  </td>
                </tr>
              ) : (
                currentProducts.map((prod, index) => (
                  <tr
                    key={prod.id}
                    className={`${
                      index % 2 === 0 ? "bg-gray-50" : "bg-white"
                    } hover:bg-indigo-100 transition-colors`}
                  >
                    <td className="py-2 px-3 border-b">{prod.codigoProducto}</td>
                    <td className="py-2 px-3 border-b">{prod.nombreProducto}</td>
                    <td className="py-2 px-3 border-b">
                      {prod.stocks && prod.stocks[filterAlmacen]
                        ? prod.stocks[filterAlmacen]
                        : 0}
                    </td>
                    <td className="py-2 px-3 border-b">
                      {prod.transitos && prod.transitos[filterAlmacen]
                        ? prod.transitos[filterAlmacen]
                        : 0}
                    </td>
                    <td className="py-2 px-3 border-b">{prod.codigoBarras}</td>
                    <td className="py-2 px-3 border-b">{prod.idMercadolibre}</td>
                    <td className="py-2 px-3 border-b">{getRubroName(prod)}</td>
                    <td className="py-2 px-3 border-b">{getSubRubroName(prod)}</td>
                    <td className="py-2 px-3 border-b">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/productos/editar/${prod.id}`}
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
                          onClick={() => confirmDelete(prod.id)}
                          disabled={!!productToDelete}
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
      </div>

      {productToDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black opacity-50"></div>
          <div className="relative bg-white rounded-lg shadow p-4 w-11/12 max-w-sm">
            <h2 className="text-lg font-semibold mb-3">Confirmar Eliminación</h2>
            <p className="mb-3">
              ¿Estás seguro de que deseas eliminar este producto?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelDelete}
                className="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
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

export default ProductTable;
