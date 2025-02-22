// App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Importar Firestore y configuración
import { db } from "./firebaseConfig";
import {
  collection,
  onSnapshot,
  getDoc,
  updateDoc,
  doc,
  addDoc,
  query,
  orderBy,
} from "firebase/firestore";

// Importar componentes y páginas
import Sidebar from "./components/Sidebar";
import ProductTable from "./components/ProductTable";
import NewProduct from "./pages/NewProduct";
import EditProduct from "./pages/EditProduct";
import Movimientos from "./pages/Movimientos";
import NuevaMovimiento from "./pages/NuevaMovimiento";
import Almacenes from "./pages/Almacenes";
import Rubros from "./pages/Rubros";
import Transferencias from "./pages/Transferencias";
import NuevaTransferencia from "./pages/NuevaTransferencia";
import RecepcionarTransferencia from "./pages/RecepcionarTransferencia";
import Compras from "./components/Compras";
import AddCompraForm from "./components/AddCompraForm";
import EditCompraForm from "./components/EditCompraForm";

// Componentes para MercadoLibre
import MercadoLibreConnections from "./components/MercadoLibreConnections";
import Publicaciones from "./components/Publicaciones";

function App() {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [transferencias, setTransferencias] = useState([]);

  // Suscripción en tiempo real a Rubros
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "rubros"), (snapshot) => {
      const temp = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        temp.push({
          id: docSnap.id,
          nombre: data.nombre,
          subRubros: data.subRubros || [],
        });
      });
      setRubros(temp);
    });
    return () => unsub();
  }, []);

  // Suscripción en tiempo real a Almacenes
  useEffect(() => {
    const q = query(collection(db, "almacenes"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const whArray = [];
      snapshot.forEach((docSnap) => {
        whArray.push({ id: docSnap.id, ...docSnap.data() });
      });
      setWarehouses(whArray);
    });
    return () => unsub();
  }, []);

  // Suscripción en tiempo real a Productos
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "productos"), (snapshot) => {
      const prodArray = [];
      snapshot.forEach((docSnap) => {
        prodArray.push({ id: docSnap.id, ...docSnap.data() });
      });
      setProducts(prodArray);
    });
    return () => unsub();
  }, []);

  // Suscripción en tiempo real a Transferencias
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "transferencias"), (snapshot) => {
      const transferArray = [];
      snapshot.forEach((docSnap) => {
        transferArray.push({ id: docSnap.id, ...docSnap.data() });
      });
      transferArray.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      setTransferencias(transferArray);
    });
    return () => unsub();
  }, []);

  // Funciones para actualizar stock y tránsito en Firestore
  const updateProductStockInFirestore = async (productId, warehouseId, newStock) => {
    try {
      const productDocRef = doc(db, "productos", productId);
      await updateDoc(productDocRef, {
        [`stocks.${warehouseId}`]: newStock,
      });
    } catch (error) {
      console.error(
        `Error actualizando stock del producto ${productId} en almacén ${warehouseId}:`,
        error
      );
    }
  };

  const updateProductTransitInFirestore = async (productId, warehouseId, newTransit) => {
    try {
      const productDocRef = doc(db, "productos", productId);
      await updateDoc(productDocRef, {
        [`transitos.${warehouseId}`]: newTransit,
      });
    } catch (error) {
      console.error(
        `Error actualizando tránsito del producto ${productId} en almacén ${warehouseId}:`,
        error
      );
    }
  };

  const actualizarStockProducto = async (prodId, warehouseId, itemCantidad, tipoMovimiento) => {
    try {
      const prodDocRef = doc(db, "productos", prodId);
      const prodSnap = await getDoc(prodDocRef);
      if (!prodSnap.exists()) {
        console.error("El producto no existe:", prodId);
        return;
      }
      const prodData = prodSnap.data();
      let currentStock = Number(prodData?.stocks?.[warehouseId] || 0);
      let newStock;
      if (tipoMovimiento === "Ingreso") {
        newStock = currentStock + Number(itemCantidad);
      } else if (tipoMovimiento === "Egreso") {
        newStock = currentStock - Number(itemCantidad);
      } else if (tipoMovimiento === "Ajuste") {
        newStock = Number(itemCantidad);
      } else {
        console.error("Tipo de movimiento desconocido:", tipoMovimiento);
        return;
      }
      newStock = Math.max(newStock, 0);
      updateProductStockInFirestore(prodId, warehouseId, newStock);
    } catch (error) {
      console.error("Error en actualizarStockProducto:", error);
    }
  };

  // Registrar movimiento manual
  const handleAddMovement = async (newMovement) => {
    try {
      await addDoc(collection(db, "movimientos"), newMovement);
    } catch (error) {
      console.error("Error al agregar movimiento:", error);
    }
  };

  // Importar movimientos desde Excel
  const handleImportMovimientos = async (importedMovements) => {
    try {
      for (const mov of importedMovements) {
        const docRef = await addDoc(collection(db, "movimientos"), mov);
        mov.id = docRef.id;
        const whId = mov.almacen ? String(mov.almacen) : null;
        if (!whId) continue;
        for (const item of mov.items) {
          const prod = products.find(
            (p) =>
              String(p.codigoProducto).trim().toLowerCase() ===
              String(item.codigoProducto).trim().toLowerCase()
          );
          if (prod) {
            await actualizarStockProducto(prod.id, whId, item.cantidad, mov.tipoMovimiento);
          }
        }
      }
    } catch (error) {
      console.error("Error importando movimientos:", error);
    }
  };

  // TRANSFERENCIAS
  const handleAddTransfer = async (newTransfer, transferItems, idOrigen, idDestino) => {
    const originId = String(idOrigen);
    const destId = String(idDestino);
    try {
      const docRef = await addDoc(collection(db, "transferencias"), newTransfer);
      newTransfer.id = docRef.id;
      setTransferencias((prev) => [...prev, newTransfer]);
    } catch (error) {
      console.error("Error al guardar la transferencia en Firestore:", error);
      return;
    }
    setProducts((prevProducts) =>
      prevProducts.map((prod) => {
        const transfQty = transferItems
          .filter(
            (item) =>
              String(item.codigoProducto).trim().toLowerCase() ===
              String(prod.codigoProducto).trim().toLowerCase()
          )
          .reduce((acc, item) => acc + Number(item.cantidad), 0);
        if (transfQty === 0) return prod;
        let newStocks = { ...prod.stocks };
        let newTransitos = { ...prod.transitos };
        newStocks[originId] = (newStocks[originId] || 0) - transfQty;
        newTransitos[destId] = (newTransitos[destId] || 0) + transfQty;
        updateProductStockInFirestore(prod.id, originId, Math.max(newStocks[originId], 0));
        updateProductTransitInFirestore(prod.id, destId, newTransitos[destId]);
        return { ...prod, stocks: newStocks, transitos: newTransitos };
      })
    );
  };

  const handleRecepcionarTransfer = (updatedTransfer) => {
    const oldTransfer = transferencias.find((t) => t.id === updatedTransfer.id) || {};
    const oldReceivedDict = {};
    if (oldTransfer.receivedItems) {
      oldTransfer.receivedItems.forEach((item) => {
        oldReceivedDict[String(item.codigoProducto).toLowerCase()] = item.received;
      });
    }
    const incrementalReceivedItems = (updatedTransfer.receivedItems || []).map((item) => {
      const code = String(item.codigoProducto).toLowerCase();
      const oldReceived = oldReceivedDict[code] || 0;
      return { ...item, incremental: item.received - oldReceived };
    });
    setTransferencias((prev) =>
      prev.map((t) => (t.id === updatedTransfer.id ? updatedTransfer : t))
    );
    const originId = String(updatedTransfer.depositoOrigenId);
    const destId = String(updatedTransfer.depositoDestinoId);
    setProducts((prevProducts) => {
      return prevProducts.map((prod) => {
        const code = String(prod.codigoProducto).toLowerCase();
        const incItem = incrementalReceivedItems.find(
          (i) => String(i.codigoProducto).toLowerCase() === code
        );
        if (incItem && incItem.incremental > 0) {
          let newTransitos = { ...prod.transitos };
          let newStocks = { ...prod.stocks };
          newTransitos[destId] = Math.max((newTransitos[destId] || 0) - incItem.incremental, 0);
          newStocks[destId] = (newStocks[destId] || 0) + incItem.incremental;
          updateProductStockInFirestore(prod.id, destId, newStocks[destId]);
          updateProductTransitInFirestore(prod.id, destId, newTransitos[destId]);
          return { ...prod, stocks: newStocks, transitos: newTransitos };
        }
        return prod;
      });
    });
    let warehouseDestinationName = updatedTransfer.depositoDestino;
    const foundWarehouse = warehouses.find(
      (w) => String(w.id) === String(updatedTransfer.depositoDestino)
    );
    if (foundWarehouse) {
      warehouseDestinationName = foundWarehouse.nombre;
    }
    incrementalReceivedItems.forEach((item) => {
      if (item.incremental > 0) {
        const newMovement = {
          fechaMovimiento: new Date().toISOString(),
          tipoMovimiento: "Recepción de transferencia",
          comprobante: updatedTransfer.comprobante,
          personal: updatedTransfer.personalRegistro,
          comentario: "Recepción de transferencia",
          almacen: warehouseDestinationName,
          items: [
            {
              codigoProducto: item.codigoProducto,
              nombreProducto: item.nombreProducto,
              cantidad: item.incremental,
            },
          ],
        };
        handleAddMovement(newMovement);
      }
    });
  };

  return (
    <Router>
      <div className="flex min-h-screen bg-gradient-to-r from-blue-50 to-indigo-50 text-black">
        <Sidebar />
        <div className="flex-1 p-4 ml-64">
          <Routes>
            <Route
              path="/productos"
              element={
                <ProductTable
                  products={products}
                  onDeleteProduct={() => {}}
                  onImportProducts={() => {}}
                  warehouses={warehouses}
                  rubros={rubros}
                />
              }
            />
            <Route
              path="/productos/nuevo"
              element={<NewProduct onAddProduct={() => {}} rubros={rubros} />}
            />
            <Route
              path="/productos/editar/:id"
              element={
                <EditProduct
                  products={products}
                  onUpdateProduct={() => {}}
                  rubros={rubros}
                />
              }
            />
            <Route
              path="/movimientos"
              element={
                <Movimientos
                  movimientos={movimientos}
                  onImportMovimientos={handleImportMovimientos}
                  products={products}
                  warehouses={warehouses}
                />
              }
            />
            <Route
              path="/movimientos/agregar"
              element={
                <NuevaMovimiento
                  products={products}
                  onAddMovement={handleAddMovement}
                  warehouses={warehouses}
                />
              }
            />
            <Route
              path="/almacenes"
              element={<Almacenes warehouses={warehouses} setWarehouses={setWarehouses} />}
            />
            <Route path="/rubros" element={<Rubros rubros={rubros} setRubros={setRubros} />} />
            <Route
              path="/transferencias"
              element={
                <Transferencias
                  transferencias={transferencias}
                  onDeleteTransfer={(id) =>
                    setTransferencias((prev) => prev.filter((t) => t.id !== id))
                  }
                />
              }
            />
            <Route
              path="/transferencias/agregar"
              element={
                <NuevaTransferencia
                  onAddTransfer={handleAddTransfer}
                  warehouses={warehouses}
                  products={products}
                />
              }
            />
            <Route
              path="/transferencias/recepcionar/:id"
              element={
                <RecepcionarTransferencia
                  transferencias={transferencias}
                  onRecepcionarTransfer={handleRecepcionarTransfer}
                  handleAddMovement={handleAddMovement}
                />
              }
            />
            <Route path="/compras" element={<Compras />} />
            <Route
              path="/compras/agregar"
              element={<AddCompraForm warehouses={warehouses} productosDisponibles={products} />}
            />
            <Route
              path="/compras/editar/:id"
              element={<EditCompraForm warehouses={warehouses} productosDisponibles={products} />}
            />
            <Route path="/mercadolibre" element={<MercadoLibreConnections />} />
            <Route path="/publicaciones" element={<Publicaciones />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
