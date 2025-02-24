import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { doc, updateDoc, getDoc, addDoc, collection } from "firebase/firestore";
import { db } from "../firebaseConfig";

// Función auxiliar para normalizar códigos de barras o producto
const normalizeBarcode = (code) =>
  String(code)
    .replace(/\ufeff/g, "")
    .replace(/[\n\r]/g, "")
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
    .trim()
    .toLowerCase();

const RecepcionarTransferencia = ({ transferencias, warehouses }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  // Buscamos la transferencia según el ID
  const transfer = transferencias.find((t) => String(t.id) === id);

  if (!transfer) {
    return (
      <div className="p-4 text-center text-xl">Transferencia no encontrada.</div>
    );
  }

  // Asumimos que en transfer.comprobante tienes un valor "AUTOGEN" o un comprobante real
  const comprobanteDisplay =
    transfer.comprobante === "AUTOGEN" ? "Comprobante" : transfer.comprobante;

  // ---------------------------------------
  // OBTENER NOMBRE DEL ALMACÉN DE DESTINO
  // ---------------------------------------
  // Suponiendo que transfer.depositoDestino es el ID del almacén de destino:
  let destWarehouseName = transfer.depositoDestino;
  if (warehouses && warehouses.length > 0) {
    const foundWarehouse = warehouses.find(
      (w) => String(w.id) === String(transfer.depositoDestino)
    );
    if (foundWarehouse) {
      destWarehouseName = foundWarehouse.nombre; // Se toma el nombre del almacén
    }
  }

  // Inicializamos los items con los datos de la transferencia y la cantidad ya recibida (si existe)
  const getInitialItems = () =>
    transfer.items.map((item) => {
      const rec = transfer.receivedItems
        ? transfer.receivedItems.find(
            (i) =>
              String(i.codigoProducto).toLowerCase() ===
              String(item.codigoProducto).toLowerCase()
          )?.received || 0
        : 0;
      return { ...item, alreadyReceived: rec, toReceive: 0 };
    });

  const [itemsState, setItemsState] = useState(getInitialItems());
  const [scannedBarcode, setScannedBarcode] = useState("");
  const timerRef = useRef(null);
  const [searchProductCode, setSearchProductCode] = useState("");
  const [searchProductName, setSearchProductName] = useState("");
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    setItemsState(getInitialItems());
  }, [transfer]);

  // Sugerencias basadas en el nombre del producto
  const nameSuggestions = itemsState.filter((item) =>
    item.nombreProducto.toLowerCase().includes(searchProductName.toLowerCase())
  );

  // Filtrar items según código y/o nombre
  const filteredItems = itemsState.filter((item) => {
    const codeMatch = searchProductCode
      ? item.codigoProducto.toLowerCase().includes(searchProductCode.toLowerCase())
      : true;
    const nameMatch = searchProductName
      ? item.nombreProducto.toLowerCase().includes(searchProductName.toLowerCase())
      : true;
    return codeMatch && nameMatch;
  });

  // Manejo del cambio de cantidad a recepcionar
  const handleChangeToReceive = (index, value) => {
    let newValue = Number(value);
    const { cantidad, alreadyReceived } = itemsState[index];
    const maxToReceive = cantidad - alreadyReceived;
    if (newValue > maxToReceive) newValue = maxToReceive;
    if (newValue < 0) newValue = 0;

    const newItems = [...itemsState];
    newItems[index].toReceive = newValue;
    setItemsState(newItems);
  };

  // Procesar el código de barras escaneado
  const processBarcode = (barcodeValue) => {
    const scanned = normalizeBarcode(barcodeValue);
    const index = itemsState.findIndex((item) => {
      const normalizedBar = item.codigoBarras
        ? normalizeBarcode(item.codigoBarras)
        : "";
      const normalizedCode = normalizeBarcode(item.codigoProducto);
      return scanned === normalizedBar || scanned === normalizedCode;
    });

    if (index !== -1) {
      const item = itemsState[index];
      const maxToReceive = item.cantidad - item.alreadyReceived;
      if (item.toReceive < maxToReceive) {
        handleChangeToReceive(index, item.toReceive + 1);
        toast.success(`Ingreso correcto para ${item.nombreProducto}`, {
          position: "top-right",
        });
      } else {
        toast.error(
          `No se puede recepcionar más de lo pendiente para ${item.nombreProducto}. Pendiente: ${maxToReceive}.`,
          { position: "top-right" }
        );
      }
    } else {
      toast.error(
        `Producto con código "${barcodeValue}" no se encontró en la transferencia.`,
        { position: "top-right" }
      );
    }
    setScannedBarcode("");
  };

  const handleBarcodeChange = (e) => {
    const value = e.target.value;
    setScannedBarcode(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (value.trim() !== "") {
        processBarcode(value);
      }
    }, 300);
  };

  const handleProductCodeSearchChange = (e) => {
    setSearchProductCode(e.target.value);
  };

  const handleProductNameSearchChange = (e) => {
    setSearchProductName(e.target.value);
    setShowNameSuggestions(true);
  };

  const handleSelectNameSuggestion = (item) => {
    setSearchProductName(item.nombreProducto);
    setShowNameSuggestions(false);
  };

  // Confirmar la recepción, actualizar la transferencia y registrar el movimiento
  const confirmReception = async () => {
    // Validar que ninguna cantidad ingresada supere lo pendiente
    for (let item of itemsState) {
      const maxToReceive = item.cantidad - item.alreadyReceived;
      if (item.toReceive > maxToReceive) {
        toast.error(
          `La cantidad a recepcionar para ${item.nombreProducto} excede lo pendiente (${maxToReceive}).`,
          { position: "top-right" }
        );
        return;
      }
    }

    // Calcular el total recibido (ya recibido + lo ingresado ahora)
    const updatedItems = itemsState.map((item) => ({
      ...item,
      totalReceived: item.alreadyReceived + item.toReceive,
    }));

    // Determinamos si la transferencia queda completamente recepcionada
    const allFullyReceived = updatedItems.every(
      (item) => item.totalReceived === item.cantidad
    );
    const updatedState = allFullyReceived
      ? "Recepcionado"
      : "Recepcionado parcialmente";

    // Preparar el arreglo "receivedItems" para guardarlo en la transferencia
    const receivedItems = updatedItems.map((item) => ({
      productId: String(item.productId),
      codigoProducto: item.codigoProducto,
      nombreProducto: item.nombreProducto,
      received: item.totalReceived,
      cantidad: item.cantidad,
    }));

    try {
      // Actualizar el documento de la transferencia en Firestore
      const transferRef = doc(db, "transferencias", String(transfer.id));
      await updateDoc(transferRef, {
        estado: updatedState,
        receivedItems: receivedItems,
      });

      // Actualizar el stock de cada producto en el almacén destino y ajustar el tránsito
      for (const item of updatedItems) {
        const productRef = doc(db, "productos", String(item.productId));
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const productData = productSnap.data();
          const destId = String(transfer.depositoDestinoId); // ID del almacén destino
          const currentStocks =
            productData.stocks && typeof productData.stocks === "object"
              ? productData.stocks
              : {};
          const currentTransitos =
            productData.transitos && typeof productData.transitos === "object"
              ? productData.transitos
              : {};
          const additionalReceived = Number(item.toReceive);

          // Nuevo stock en destino
          const newStockDestino =
            Number(currentStocks[destId] || 0) + additionalReceived;
          // Se descuenta esa cantidad de "tránsito"
          const newTransitoDestino = Math.max(
            Number(currentTransitos[destId] || 0) - additionalReceived,
            0
          );

          await updateDoc(productRef, {
            [`stocks.${destId}`]: newStockDestino,
            [`transitos.${destId}`]: newTransitoDestino,
          });
        } else {
          console.error(`Producto con ID ${item.productId} no existe.`);
        }
      }

      // Registrar el movimiento de recepción agrupado en la colección "movimientos"
      const newMovement = {
        fechaMovimiento: new Date().toISOString(),
        tipoMovimiento: "Recepción de transferencia",
        // Se asigna el NOMBRE del almacén destino obtenido previamente
        almacen: destWarehouseName,
        clienteProveedor: transfer.codigo,
        comprobante:
          transfer.comprobante === "AUTOGEN" ? "Comprobante" : transfer.comprobante,
        personal: transfer.personalRegistro,
        comentario: "Recepción de transferencia",
        items: updatedItems
          .filter((item) => item.toReceive > 0)
          .map((item) => ({
            codigoProducto: item.codigoProducto,
            nombreProducto: item.nombreProducto,
            cantidad: item.toReceive,
          })),
      };

      // (Opcional) Verificar en consola el movimiento que se guardará
      console.log("Movimiento a registrar:", newMovement);

      await addDoc(collection(db, "movimientos"), newMovement);

      toast.success("Recepción confirmada y movimiento registrado exitosamente");
      navigate("/transferencias");
    } catch (error) {
      console.error("Error updating reception:", error);
      toast.error("Error updating reception: " + error.message);
    }
  };

  const handleConfirmClick = () => {
    setShowConfirmModal(true);
  };

  const handleCloseModal = () => {
    setShowConfirmModal(false);
  };

  // Cálculo de totales
  const totalProductosRecepcionados = itemsState.filter(
    (item) => item.toReceive > 0
  ).length;
  const totalUnidadesRecepcionadas = itemsState.reduce(
    (acc, item) => acc + Number(item.toReceive),
    0
  );

  return (
    <div className="max-w-7xl mx-auto p-4 bg-white shadow rounded">
      <header className="mb-4">
        <h1 className="text-3xl font-bold text-center">
          Recepcionar Transferencia
        </h1>
        <p className="text-center text-gray-600">
          {comprobanteDisplay} - {transfer.codigo}
        </p>
      </header>

      {/* Campos de búsqueda y escaneo */}
      <section className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label
            htmlFor="barcodeInput"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Código de Barras
          </label>
          <input
            type="text"
            id="barcodeInput"
            value={scannedBarcode}
            onChange={handleBarcodeChange}
            placeholder="Escanee..."
            autoFocus
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="productCodeSearch"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Filtro Código Producto
          </label>
          <input
            type="text"
            id="productCodeSearch"
            value={searchProductCode}
            onChange={handleProductCodeSearchChange}
            placeholder="Ingrese código..."
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="relative">
          <label
            htmlFor="productNameSearch"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Filtro Nombre
          </label>
          <input
            type="text"
            id="productNameSearch"
            value={searchProductName}
            onChange={handleProductNameSearchChange}
            placeholder="Ingrese nombre..."
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          {showNameSuggestions &&
            searchProductName &&
            nameSuggestions.length > 0 && (
              <ul className="absolute z-20 w-full bg-white border rounded shadow mt-1 max-h-48 overflow-y-auto text-sm">
                {nameSuggestions.map((item, idx) => (
                  <li
                    key={idx}
                    className="p-1 hover:bg-gray-100 cursor-pointer"
                    onMouseDown={() => handleSelectNameSuggestion(item)}
                  >
                    <span className="font-semibold">{item.codigoProducto}</span> -{" "}
                    {item.nombreProducto}
                  </li>
                ))}
              </ul>
            )}
        </div>
      </section>

      {/* Tabla de recepción */}
      <section className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-200 sticky top-0 text-xs">
            <tr>
              <th className="border p-2 text-left">Código Producto</th>
              <th className="border p-2 text-left">Nombre Producto</th>
              <th className="border p-2 text-center">Cant. Transferida</th>
              <th className="border p-2 text-center">Cant. a Recepcionar</th>
              <th className="border p-2 text-center">Pendiente</th>
            </tr>
          </thead>
          <tbody className="text-xs">
            {filteredItems.map((item, index) => {
              const pending = item.cantidad - item.alreadyReceived - item.toReceive;
              return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border p-1">{item.codigoProducto}</td>
                  <td className="border p-1">{item.nombreProducto}</td>
                  <td className="border p-1 text-center">{item.cantidad}</td>
                  <td className="border p-1 text-center">
                    <input
                      type="number"
                      min="0"
                      max={item.cantidad - item.alreadyReceived}
                      value={item.toReceive}
                      onChange={(e) => handleChangeToReceive(index, e.target.value)}
                      className="w-full p-1 border rounded text-center text-xs"
                    />
                  </td>
                  <td className="border p-1 text-center">{pending}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Totales */}
      <section className="mt-4 text-right text-sm md:text-base">
        <div className="font-semibold text-gray-800 mb-2">
          Total Productos a recepcionar:{" "}
          <span className="ml-1">{totalProductosRecepcionados}</span>
        </div>
        <div className="font-semibold text-gray-800">
          Total Unidades a recepcionar:{" "}
          <span className="ml-1">{totalUnidadesRecepcionadas}</span>
        </div>
      </section>

      {/* Botones de acción */}
      <section className="flex justify-end gap-4 mt-4">
        <button
          onClick={handleConfirmClick}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm md:text-base font-medium"
        >
          Confirmar Recepción
        </button>
        <Link
          to="/transferencias"
          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm md:text-base font-medium"
        >
          Cancelar
        </Link>
      </section>

      {/* Modal de confirmación */}
      {showConfirmModal && (
        <div className="fixed inset-0 flex items-center justify-center z-30">
          <div className="absolute inset-0 bg-black opacity-50"></div>
          <div className="bg-white rounded-lg shadow-lg p-6 z-40 max-w-sm mx-auto">
            <h2 className="text-xl font-bold mb-4 text-center">
              Confirmar Recepción
            </h2>
            <p className="mb-6 text-center">
              ¿Está seguro que desea confirmar la recepción de esta transferencia?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  confirmReception();
                  setShowConfirmModal(false);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </div>
  );
};

export default RecepcionarTransferencia;
