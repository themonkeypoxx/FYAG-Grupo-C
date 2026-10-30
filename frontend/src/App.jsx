import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<h1>Dashboard FYAG</h1>} />
        <Route path="/nueva-obra" element={<h1>Formulario de Obras</h1>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;