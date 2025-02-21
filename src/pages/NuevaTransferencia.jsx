// src/pages/NuevaTransferencia.jsx
import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebaseConfig";

const NuevaTransferencia = ({ warehouses = [], products = [] }) => {
  const navigate = useNavigate();

  // Estados generales
  const [comprobante, setComprobante] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Selección de almacenes
  const [almacenOrigen, setAlmacenOrigen] = useState("");
  const [almacenDestino, setAlmacenDestino] = useState("");

  // Datos del producto a agregar
  const [typedCode, setTypedCode] = useState("");
  const [typedName, setTypedName] = useState("");
  const [typedQty, setTypedQty] = useState("");

  // Control del desplegable de sugerencias
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Lista de productos a transferir
  const [transferItems, setTransferItems] = useState([]);

  // Estado para notificaciones
  const [notification, setNotification] = useState(null);

  // Estado para mostrar el modal de confirmación
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Bandera para saber si se ha seleccionado un producto de las sugerencias
  const [productSelected, setProductSelected] = useState(false);

  // Estados para saber si los inputs están enfocados (para evitar autocompletar mientras se escribe)
  const [codeFocused, setCodeFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);

  // Función auxiliar para mostrar notificaciones
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  // Autocompletar: si se ingresa el código y el nombre está vacío, completar el nombre.
  useEffect(() => {
    if (productSelected) return; // No autocompletar si ya se seleccionó un producto
    if (codeFocused) return; // No autocompletar mientras se escribe
    const codeInput = typedCode.trim().toLowerCase();
    if (codeInput && !typedName.trim()) {
      const product = products.find((p) => {
        const code = String(p.codigoProducto || "").toLowerCase();
        const barcode = String(p.codigoBarras || "").toLowerCase();
        return code === codeInput || barcode === codeInput;
      });
      if (product) {
        setTypedName(product.nombreProducto || "");
      }
    }
  }, [typedCode, typedName, products, productSelected, codeFocused]);

  // Autocompletar: si se ingresa el nombre y el código está vacío, completar el código.
  useEffect(() => {
    if (productSelected) return; // No autocompletar si ya se seleccionó un producto
    if (nameFocused) return; // No autocompletar mientras se escribe
    const nameInput = typedName.trim().toLowerCase();
    if (nameInput && !typedCode.trim()) {
      const product = products.find(
        (p) => String(p.nombreProducto || "").toLowerCase() === nameInput
      );
      if (product) {
        setTypedCode(product.codigoProducto || "");
      }
    }
  }, [typedName, typedCode, products, productSelected, nameFocused]);

  // Lógica de sugerencias: combinar código y nombre para buscar coincidencias
  const suggestions = useMemo(() => {
    const input = ((typedCode || "") + " " + (typedName || "")).trim().toLowerCase();
    if (!input) return [];
    return products.filter((p) => {
      const prodName = String(p.nombreProducto || "").toLowerCase();
      const prodCode = String(p.codigoProducto || "").toLowerCase();
      const prodBar = String(p.codigoBarras || "").toLowerCase();
      return (
        prodName.includes(input) ||
        prodCode.includes(input) ||
        prodBar.includes(input)
      );
    });
  }, [typedCode, typedName, products]);

  // Al seleccionar una sugerencia se completan ambos campos y se marca la selección
  const handleSelectSuggestion = (product) => {
    setTypedName(product.nombreProducto || "");
    setTypedCode(product.codigoProducto || "");
    setProductSelected(true);
    setShowSuggestions(false);
  };

  // Función para agregar un producto a la transferencia
  const handleAddItem = () => {
    if (!typedCode || !typedName || !typedQty) {
      showNotification("error", "Completa código, nombre y cantidad");
      return;
    }
    const quantityNum = Number(typedQty);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      showNotification("error", "La cantidad debe ser un número mayor a 0");
      return;
    }
    if (!almacenOrigen) {
      showNotification("error", "Selecciona el Almacén de Origen antes de agregar productos");
      return;
    }
    // Buscar el producto por código o código de barras
    const productFound = products.find((p) => {
      const prodCode = String(p.codigoProducto || "").toLowerCase();
      const prodBar = String(p.codigoBarras || "").toLowerCase();
      return prodCode === typedCode.toLowerCase() || prodBar === typedCode.toLowerCase();
    });
    if (!productFound) {
      showNotification("error", "Producto no encontrado");
      return;
    }
    // Validar stock en el almacén de origen
    const availableStock =
      productFound.stocks && productFound.stocks[almacenOrigen]
        ? productFound.stocks[almacenOrigen]
        : 0;
    if (availableStock < quantityNum) {
      showNotification(
        "error",
        `Stock insuficiente en el depósito de origen. Stock disponible: ${availableStock}`
      );
      return;
    }
    // Crear el nuevo ítem de transferencia
    const newItem = {
      productId: productFound.id,
      codigoProducto: productFound.codigoProducto,
      nombreProducto: productFound.nombreProducto,
      cantidad: quantityNum,
      codigoBarras: productFound.codigoBarras || "",
    };
    setTransferItems((prev) => [...prev, newItem]);
    // Reiniciar campos y flags
    setTypedCode("");
    setTypedName("");
    setTypedQty("");
    setProductSelected(false);
    setShowSuggestions(false);
    showNotification("success", "Producto agregado a la transferencia");
  };

  const totalUnidades = transferItems.reduce((acc, item) => acc + item.cantidad, 0);
  const totalProductos = transferItems.length;

  // Validación de almacenes
  const validarAlmacenes = () => {
    if (!almacenOrigen || !almacenDestino) {
      alert("Selecciona Almacén de Origen y de Destino.");
      return false;
    }
    if (almacenOrigen === almacenDestino) {
      alert("El Almacén de Origen no puede ser el mismo que el de Destino.");
      return false;
    }
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!comprobante.trim()) {
      alert("El comprobante es obligatorio");
      return;
    }
    if (!validarAlmacenes()) return;
    if (transferItems.length === 0) {
      alert("Agrega al menos un producto a transferir");
      return;
    }
    // Mostrar modal de confirmación
    setShowConfirmModal(true);
  };

  // Funciones para actualizar stock y tránsito en Firestore
  const updateProductStockInFirestore = async (productId, warehouseId, newStock) => {
    try {
      const prodRef = doc(db, "productos", productId);
      await updateDoc(prodRef, { [`stocks.${warehouseId}`]: newStock });
    } catch (error) {
      console.error(`Error actualizando stock del producto ${productId} en ${warehouseId}:`, error);
    }
  };

  const updateProductTransitInFirestore = async (productId, warehouseId, newTransit) => {
    try {
      const prodRef = doc(db, "productos", productId);
      await updateDoc(prodRef, { [`transitos.${warehouseId}`]: newTransit });
    } catch (error) {
      console.error(`Error actualizando tránsito del producto ${productId} en ${warehouseId}:`, error);
    }
  };

  // Al confirmar la transferencia, se agrega el documento y se actualizan los productos
  const handleConfirmTransfer = async () => {
    const now = new Date();
    const fechaHora = now.toISOString();

    const newTransfer = {
      fecha: fechaHora,
      codigo: "AUTOGEN",
      nombre: "Transferencia Generada",
      comprobante,
      estado: "Pendiente de recepción",
      observaciones,
      depositoOrigen: warehouses.find((w) => w.id === almacenOrigen)?.nombre || "",
      depositoDestino: warehouses.find((w) => w.id === almacenDestino)?.nombre || "",
      depositoOrigenId: almacenOrigen,
      depositoDestinoId: almacenDestino,
      personalRegistro: "",
      items: transferItems,
    };

    try {
      await addDoc(collection(db, "transferencias"), newTransfer);

      for (const item of transferItems) {
        const productFound = products.find(
          (p) =>
            p.codigoProducto.trim().toLowerCase() ===
            item.codigoProducto.trim().toLowerCase()
        );
        if (productFound) {
          const currentStock =
            productFound.stocks && productFound.stocks[almacenOrigen]
              ? productFound.stocks[almacenOrigen]
              : 0;
          const currentTransit =
            productFound.transitos && productFound.transitos[almacenDestino]
              ? productFound.transitos[almacenDestino]
              : 0;
          const cantidad = Number(item.cantidad);
          const newStock = currentStock - cantidad;
          const newTransit = currentTransit + cantidad;
          await updateProductStockInFirestore(productFound.id, almacenOrigen, newStock);
          await updateProductTransitInFirestore(productFound.id, almacenDestino, newTransit);
        } else {
          console.error("Producto no encontrado:", item.codigoProducto);
        }
      }
      navigate("/transferencias");
    } catch (error) {
      console.error("Error al agregar la transferencia:", error);
      alert("Error al agregar la transferencia: " + error.message);
    }
  };

  // Función para eliminar un producto de la lista de transferencia
  const handleRemoveItem = (indexToRemove) => {
    setTransferItems((prevItems) =>
      prevItems.filter((_, index) => index !== indexToRemove)
    );
    showNotification("success", "Producto eliminado de la transferencia");
  };

  return (
    <div className="w-full h-full bg-white text-black min-h-screen p-4 relative">
      {notification && (
        <div
          className={`fixed top-4 right-4 p-3 rounded shadow z-50 ${
            notification.type === "error" ? "bg-red-500" : "bg-green-500"
          } text-white`}
        >
          {notification.message}
        </div>
      )}
      <div className="max-w-[95%] mx-auto py-4">
        <h1 className="text-2xl font-bold mb-4">Nueva Transferencia</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <label className="text-sm font-semibold mb-1">Comprobante *</label>
              <input
                type="text"
                value={comprobante}
                onChange={(e) => setComprobante(e.target.value)}
                className="p-1 border rounded text-sm"
                placeholder="Obligatorio"
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold mb-1">Almacén Origen</label>
              <select
                value={almacenOrigen}
                onChange={(e) => setAlmacenOrigen(e.target.value)}
                className="p-1 border rounded text-sm"
              >
                <option value="">-- Seleccionar --</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold mb-1">Almacén Destino</label>
              <select
                value={almacenDestino}
                onChange={(e) => setAlmacenDestino(e.target.value)}
                className="p-1 border rounded text-sm"
              >
                <option value="">-- Seleccionar --</option>
                {warehouses
                  .filter((w) => w.id !== almacenOrigen)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.nombre}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold mb-1">Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={1}
                className="p-1 border rounded text-sm"
              />
            </div>
          </div>
          <div className="border rounded bg-gray-50 p-3">
            <h2 className="text-sm font-semibold mb-3">Agregar Productos</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1">Código</label>
                <input
                  type="text"
                  value={typedCode}
                  onFocus={() => {
                    setProductSelected(false);
                    setCodeFocused(true);
                    setShowSuggestions(true);
                  }}
                  onBlur={() => setCodeFocused(false)}
                  onChange={(e) => {
                    setTypedCode(e.target.value);
                    setProductSelected(false);
                  }}
                  placeholder="Ej. P001"
                  className="p-1 border rounded text-sm"
                />
              </div>
              <div className="relative flex flex-col">
                <label className="text-xs font-semibold mb-1">Nombre</label>
                <input
                  type="text"
                  value={typedName}
                  onFocus={() => {
                    setProductSelected(false);
                    setNameFocused(true);
                    setShowSuggestions(true);
                  }}
                  onBlur={() => setNameFocused(false)}
                  onChange={(e) => {
                    setTypedName(e.target.value);
                    setProductSelected(false);
                  }}
                  placeholder="Nombre del producto..."
                  className="p-1 border rounded text-sm"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute left-0 w-full top-full bg-white border rounded shadow z-20 max-h-40 overflow-auto text-sm">
                    {suggestions.map((prod, i) => (
                      <li
                        key={prod.id || i}
                        className="px-2 py-1 hover:bg-gray-200 cursor-pointer"
                        onMouseDown={() => handleSelectSuggestion(prod)}
                      >
                        {prod.nombreProducto} - {prod.codigoProducto}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1">Cantidad</label>
                <input
                  type="number"
                  value={typedQty}
                  onChange={(e) => setTypedQty(e.target.value)}
                  placeholder="Cantidad..."
                  className="p-1 border rounded text-sm"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="mt-3 bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm"
            >
              + Agregar producto
            </button>
          </div>
          {transferItems.length > 0 && (
            <div className="mt-4">
              <table className="w-full text-sm border border-gray-300">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="py-1 px-2 border-b">Código</th>
                    <th className="py-1 px-2 border-b">Nombre</th>
                    <th className="py-1 px-2 border-b">Cantidad</th>
                    <th className="py-1 px-2 border-b">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {transferItems.map((item, index) => (
                    <tr key={index} className="text-center hover:bg-gray-50 transition">
                      <td className="py-1 px-2 border-b">{item.codigoProducto}</td>
                      <td className="py-1 px-2 border-b">{item.nombreProducto}</td>
                      <td className="py-1 px-2 border-b">{item.cantidad}</td>
                      <td className="py-1 px-2 border-b">
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded text-xs"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 flex justify-end gap-4 text-sm">
                <div>
                  <strong>Total Productos: </strong> {totalProductos}
                </div>
                <div>
                  <strong>Total Unidades: </strong> {totalUnidades}
                </div>
              </div>
            </div>
          )}
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
          >
            Confirmar Transferencia
          </button>
        </form>
      </div>
      {showConfirmModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black opacity-50"></div>
          <div className="relative bg-white rounded-lg shadow p-4 w-11/12 max-w-sm">
            <h2 className="text-lg font-semibold mb-3">Confirmar Transferencia</h2>
            <p className="mb-3">¿Estás seguro de que deseas confirmar la transferencia?</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmTransfer}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NuevaTransferencia;
