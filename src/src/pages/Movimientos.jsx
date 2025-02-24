// src/pages/Movimientos.jsx
import React, { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  increment
} from "firebase/firestore";
import { db } from "../firebaseConfig";

const Movimientos = ({ warehouses = [], products = [] }) => {
  // Estados para movimientos y filtros
  const [movimientos, setMovimientos] = useState([]);
  const [filterFechaDesde, setFilterFechaDesde] = useState("");
  const [filterFechaHasta, setFilterFechaHasta] = useState("");
  const [filterCodigo, setFilterCodigo] = useState("");
  const [filterProducto, setFilterProducto] = useState("");
  const [filterAlmacen, setFilterAlmacen] = useState("");
  const [filterPersonal, setFilterPersonal] = useState("");
  const [filterTipoMovimiento, setFilterTipoMovimiento] = useState("");
  
  // Estado para notificaciones
  const [notification, setNotification] = useState({ message: "", type: "" });
  
  const fileInputRef = useRef(null);

  // Función para mostrar notificaciones
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: "", type: "" }), 4000);
  };

  // Suscribirse a la colección "movimientos" en Firestore
  useEffect(() => {
    const q = collection(db, "movimientos");
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = [];
        snapshot.forEach((docSnap) => {
          docs.push({ id: docSnap.id, ...docSnap.data() });
        });
        console.log("Movimientos recibidos:", docs);
        setMovimientos(docs);
      },
      (error) => {
        console.error("Error leyendo movimientos:", error);
        showNotification("Error al cargar movimientos", "error");
      }
    );
    return () => unsubscribe();
  }, []);

  // Función para actualizar el stock de un producto de forma atómica usando increment
  const updateProductStockAtomic = async (productId, warehouseId, cantidad, tipoMovimiento) => {
    try {
      const productDocRef = doc(db, "productos", productId);
      // Si el tipo es Ingreso o Recepción de transferencia, se incrementa el stock
      if (tipoMovimiento === "Ingreso" || tipoMovimiento === "Recepción de transferencia") {
        await updateDoc(productDocRef, {
          [`stocks.${warehouseId}`]: increment(Number(cantidad))
        });
        console.log(`Se incrementó en ${cantidad} el stock del producto ${productId} en almacén ${warehouseId}`);
      } else if (tipoMovimiento === "Egreso") {
        await updateDoc(productDocRef, {
          [`stocks.${warehouseId}`]: increment(-Number(cantidad))
        });
        console.log(`Se decrementó en ${cantidad} el stock del producto ${productId} en almacén ${warehouseId}`);
      } else if (tipoMovimiento === "Ajuste") {
        // Para ajustes se reemplaza el valor del stock
        await updateDoc(productDocRef, {
          [`stocks.${warehouseId}`]: Number(cantidad)
        });
        console.log(`Se ajustó el stock del producto ${productId} a ${cantidad} en almacén ${warehouseId}`);
      } else {
        console.error("Tipo de movimiento desconocido:", tipoMovimiento);
      }
    } catch (error) {
      console.error("Error actualizando stock atómico:", error);
    }
  };

  // Función para importar movimientos desde un archivo Excel
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    console.log("Archivo seleccionado:", file.name);

    const reader = new FileReader();
    reader.onerror = (err) => {
      console.error("Error leyendo el archivo:", err);
      showNotification("Error leyendo el archivo", "error");
    };

    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target.result;
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        console.log("Workbook leído:", workbook);

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        console.log("Hoja seleccionada:", sheetName);

        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        console.log("Datos extraídos:", jsonData);

        if (!jsonData || jsonData.length === 0) {
          showNotification("No se encontraron datos en el Excel", "error");
          return;
        }

        // Mapear cada fila a un objeto "movimiento"
        const importedMovements = jsonData.map((row, index) => {
          // Normalizar claves a minúsculas sin espacios
          const lower = {};
          Object.keys(row).forEach((key) => {
            lower[key.toLowerCase().trim()] = row[key];
          });
          console.log(`Fila ${index + 1} - claves:`, Object.keys(lower));

          // Extraer código de producto
          const codigoProducto =
            lower["código producto"] ||
            lower["codigo producto"] ||
            lower["código"] ||
            lower["codigo"] ||
            "";
          // Extraer nombre del producto
          let nombreProducto =
            lower["nombre producto"] ||
            lower["nombre del producto"] ||
            lower["nombre"] ||
            lower["producto"] ||
            "";
          if (!nombreProducto && codigoProducto) {
            const found = products.find(
              (p) =>
                p.codigoProducto &&
                p.codigoProducto.trim().toLowerCase() === codigoProducto.trim().toLowerCase()
            );
            if (found) {
              nombreProducto = found.nombreProducto;
            }
          }
          // Obtener la cantidad (numérica)
          const cantidad = Number(lower["cantidad"] || 0);

          // Normalizar tipo de movimiento
          let tipoMovimientoRaw =
            lower["tipo movimiento"] ||
            lower["tipo de movimiento"] ||
            lower["tipomovimiento"] ||
            lower["tipo"] ||
            "";
          tipoMovimientoRaw = tipoMovimientoRaw.trim().toLowerCase();
          let tipoMovimiento = "";
          if (tipoMovimientoRaw === "ingreso") {
            tipoMovimiento = "Ingreso";
          } else if (tipoMovimientoRaw === "egreso") {
            tipoMovimiento = "Egreso";
          } else if (tipoMovimientoRaw === "ajuste") {
            tipoMovimiento = "Ajuste";
          } else if (tipoMovimientoRaw === "recepción de transferencia" || tipoMovimientoRaw === "recepcion de transferencia") {
            tipoMovimiento = "Recepción de transferencia";
          } else {
            console.error(`Fila ${index + 1}: Tipo de movimiento desconocido: ${tipoMovimientoRaw}`);
            tipoMovimiento = tipoMovimientoRaw;
          }

          // Extraer y normalizar el almacén (se espera que en el Excel venga el nombre)
          const almacenRaw = lower["almacén"] || lower["almacen"] || "";
          let almacen = "";
          if (almacenRaw) {
            const foundAlm = warehouses.find(
              (w) =>
                w.nombre &&
                w.nombre.trim().toLowerCase() === almacenRaw.trim().toLowerCase()
            );
            if (foundAlm) {
              almacen = foundAlm.id;
            } else {
              throw new Error(`Fila ${index + 1}: No se encontró almacén con el nombre "${almacenRaw}" en la base de datos.`);
            }
          } else {
            throw new Error(`Fila ${index + 1}: El campo 'almacen' es obligatorio.`);
          }

          // Procesar la fecha; si no se especifica, usar la fecha actual
          let fechaMovimiento = new Date().toISOString();
          if (lower["fecha movimiento"] || lower["fecha"]) {
            try {
              fechaMovimiento = new Date(lower["fecha movimiento"] || lower["fecha"]).toISOString();
            } catch (error) {
              console.error(`Fila ${index + 1}: Error parseando la fecha`, error);
            }
          }

          console.log(
            `Fila ${index + 1} - Código: "${codigoProducto}", Nombre: "${nombreProducto}", Tipo: "${tipoMovimiento}", Almacén (ID): "${almacen}"`
          );

          if (!codigoProducto || !nombreProducto) {
            throw new Error(`Fila ${index + 1}: El formato del Excel es incorrecto. Cada fila debe tener 'codigoProducto' y 'nombreProducto'.`);
          }

          return {
            fechaMovimiento,
            tipoMovimiento,
            almacen,
            items: [
              {
                codigoProducto,
                nombreProducto,
                cantidad,
              },
            ],
            clienteProveedor: lower["cliente/proveedor"] || lower["cliente proveedor"] || "",
            comprobante: lower["comprobante"] || "",
            personal: lower["personal"] || "",
            comentario: lower["comentario"] || "",
          };
        });

        console.log("Movimientos a importar:", importedMovements);

        // Procesar cada movimiento importado: guardarlo en Firestore y actualizar stock
        for (const mov of importedMovements) {
          try {
            const docRef = await addDoc(collection(db, "movimientos"), mov);
            mov.id = docRef.id;
            console.log("Movimiento agregado con ID:", mov.id);
            const whId = mov.almacen ? String(mov.almacen) : null;
            if (!whId) {
              console.error("Movimiento sin almacén definido:", mov);
              continue;
            }
            for (const item of mov.items) {
              const prod = products.find(
                (p) =>
                  String(p.codigoProducto).trim().toLowerCase() ===
                  String(item.codigoProducto).trim().toLowerCase()
              );
              if (prod) {
                await updateProductStockAtomic(prod.id, whId, item.cantidad, mov.tipoMovimiento);
              } else {
                console.error("No se encontró producto para el código:", item.codigoProducto);
              }
            }
          } catch (error) {
            console.error("Error agregando movimiento:", error);
            showNotification(`Error agregando movimiento: ${error.message}`, "error");
          }
        }

        showNotification(`Se importaron ${importedMovements.length} movimientos con éxito.`, "success");
      } catch (error) {
        console.error("Error procesando el archivo Excel:", error);
        showNotification(error.message, "error");
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  const handleImportClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  // Filtros para la tabla
  const uniqueMovementTypes = Array.from(
    new Set(movimientos.map((mov) => mov.tipoMovimiento).filter((tipo) => Boolean(tipo)))
  );

  let filteredMovimientos = movimientos.filter((mov) => {
    const movDate = new Date(mov.fechaMovimiento);
    if (filterFechaDesde && movDate < new Date(filterFechaDesde)) return false;
    if (filterFechaHasta && movDate > new Date(filterFechaHasta)) return false;
    if (filterCodigo || filterProducto) {
      const match = mov.items?.some((item) => {
        const codeMatch = filterCodigo
          ? item.codigoProducto?.toLowerCase().includes(filterCodigo.toLowerCase())
          : true;
        const nameMatch = filterProducto
          ? item.nombreProducto?.toLowerCase().includes(filterProducto.toLowerCase())
          : true;
        return codeMatch && nameMatch;
      });
      if (!match) return false;
    }
    if (filterAlmacen) {
      const warehouseName =
        warehouses.find(
          (wh) =>
            String(wh.id) === String(mov.almacén) ||
            String(wh.id) === String(mov.almacen)
        )?.nombre || mov.almacen;
      if (!String(warehouseName).toLowerCase().includes(filterAlmacen.toLowerCase())) {
        return false;
      }
    }
    if (filterPersonal && !mov.personal?.toLowerCase().includes(filterPersonal.toLowerCase())) {
      return false;
    }
    if (filterTipoMovimiento && mov.tipoMovimiento !== filterTipoMovimiento) {
      return false;
    }
    return true;
  });

  filteredMovimientos = filteredMovimientos.sort(
    (a, b) => new Date(b.fechaMovimiento) - new Date(a.fechaMovimiento)
  );

  return (
    <div className="p-4">
      {/* Notificación visual */}
      {notification.message && (
        <div
          className={`mb-4 p-3 rounded ${
            notification.type === "error" ? "bg-red-200 text-red-800" : "bg-green-200 text-green-800"
          }`}
        >
          {notification.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Movimientos</h1>
        <div className="flex gap-2">
          <button
            onClick={handleImportClick}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
          >
            Importar
          </button>
          <button
            onClick={() => {}}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded"
          >
            Exportar
          </button>
          <Link
            to="/movimientos/agregar"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Agregar
          </Link>
        </div>
        <input
          type="file"
          accept=".xlsx, .xls"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
      </div>

      {/* Filtros */}
      <div className="mb-4 p-2 bg-white shadow rounded">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label htmlFor="fechaDesde" className="block text-xs font-medium mb-1">
              Fecha Desde:
            </label>
            <input
              type="date"
              id="fechaDesde"
              value={filterFechaDesde}
              onChange={(e) => setFilterFechaDesde(e.target.value)}
              className="w-full p-1 border rounded text-black text-xs"
            />
          </div>
          <div>
            <label htmlFor="fechaHasta" className="block text-xs font-medium mb-1">
              Fecha Hasta:
            </label>
            <input
              type="date"
              id="fechaHasta"
              value={filterFechaHasta}
              onChange={(e) => setFilterFechaHasta(e.target.value)}
              className="w-full p-1 border rounded text-black text-xs"
            />
          </div>
          <div>
            <label htmlFor="filterCodigo" className="block text-xs font-medium mb-1">
              Código Producto:
            </label>
            <input
              type="text"
              id="filterCodigo"
              value={filterCodigo}
              onChange={(e) => setFilterCodigo(e.target.value)}
              placeholder="Código..."
              className="w-full p-1 border rounded text-black text-xs"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
          <div>
            <label htmlFor="filterProducto" className="block text-xs font-medium mb-1">
              Nombre Producto:
            </label>
            <input
              type="text"
              id="filterProducto"
              value={filterProducto}
              onChange={(e) => setFilterProducto(e.target.value)}
              placeholder="Nombre..."
              className="w-full p-1 border rounded text-black text-xs"
            />
          </div>
          <div>
            <label htmlFor="filterAlmacen" className="block text-xs font-medium mb-1">
              Almacén:
            </label>
            <input
              type="text"
              id="filterAlmacen"
              value={filterAlmacen}
              onChange={(e) => setFilterAlmacen(e.target.value)}
              placeholder="Almacén..."
              className="w-full p-1 border rounded text-black text-xs"
            />
          </div>
          <div>
            <label htmlFor="filterPersonal" className="block text-xs font-medium mb-1">
              Personal:
            </label>
            <input
              type="text"
              id="filterPersonal"
              value={filterPersonal}
              onChange={(e) => setFilterPersonal(e.target.value)}
              placeholder="Personal..."
              className="w-full p-1 border rounded text-black text-xs"
            />
          </div>
          <div>
            <label htmlFor="filterTipoMovimiento" className="block text-xs font-medium mb-1">
              Tipo Movimiento:
            </label>
            <select
              id="filterTipoMovimiento"
              value={filterTipoMovimiento}
              onChange={(e) => setFilterTipoMovimiento(e.target.value)}
              className="w-full p-1 border rounded text-black text-xs"
            >
              <option value="">Todos</option>
              {uniqueMovementTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Movimientos */}
      <div className="bg-white shadow rounded border-2 border-blue-500 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-blue-500">
            <tr>
              <th className="py-2 px-3 text-left text-white">Almacén</th>
              <th className="py-2 px-3 text-left text-white">Fecha Movimiento</th>
              <th className="py-2 px-3 text-left text-white">Cliente/Proveedor</th>
              <th className="py-2 px-3 text-left text-white">Código Producto</th>
              <th className="py-2 px-3 text-left text-white">Nombre Producto</th>
              <th className="py-2 px-3 text-left text-white">Cantidad</th>
              <th className="py-2 px-3 text-left text-white">Tipo Movimiento</th>
              <th className="py-2 px-3 text-left text-white">Comprobante</th>
              <th className="py-2 px-3 text-left text-white">Personal</th>
              <th className="py-2 px-3 text-left text-white">Comentario</th>
            </tr>
          </thead>
          <tbody>
            {filteredMovimientos.length === 0 ? (
              <tr>
                <td colSpan="10" className="py-3 text-center text-black">
                  No hay movimientos disponibles.
                </td>
              </tr>
            ) : (
              filteredMovimientos.map((mov) =>
                mov.items && mov.items.length > 0 ? (
                  mov.items.map((item, idx) => {
                    const fecha = new Date(mov.fechaMovimiento);
                    const fechaConHora = !isNaN(fecha.getTime())
                      ? fecha.toLocaleString("es-ES", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : mov.fechaMovimiento;
                    
                    // MODIFICACIÓN: Si es recepción de transferencia, usar directamente el valor de "almacen" (nombre del depósito destino)
                    let warehouseName = "";
                    if (mov.tipoMovimiento === "Recepción de transferencia") {
                      warehouseName = mov.almacen;
                    } else {
                      warehouseName =
                        warehouses.find(
                          (wh) =>
                            String(wh.id) === String(mov.almacén) ||
                            String(wh.id) === String(mov.almacen)
                        )?.nombre || mov.almacen;
                    }

                    return (
                      <tr key={`${mov.id}-${idx}`} className="hover:bg-indigo-100 transition-colors">
                        <td className="py-2 px-3 border-b">{warehouseName}</td>
                        <td className="py-2 px-3 border-b">{fechaConHora}</td>
                        <td className="py-2 px-3 border-b">{mov.clienteProveedor}</td>
                        <td className="py-2 px-3 border-b">{item.codigoProducto}</td>
                        <td className="py-2 px-3 border-b">{item.nombreProducto}</td>
                        <td className="py-2 px-3 border-b">{item.cantidad}</td>
                        <td className="py-2 px-3 border-b">{mov.tipoMovimiento}</td>
                        <td className="py-2 px-3 border-b">{mov.comprobante}</td>
                        <td className="py-2 px-3 border-b">{mov.personal}</td>
                        <td className="py-2 px-3 border-b">{mov.comentario}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr key={mov.id}>
                    <td colSpan="10" className="py-3 text-center text-black">
                      No hay productos en este movimiento.
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Movimientos;
