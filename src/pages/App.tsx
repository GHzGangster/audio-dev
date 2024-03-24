import React from 'react';
import './App.css';
import { HashRouter, Route, Routes } from "react-router-dom";
import Header from "./Header";
import Home from "./Home";
import Run from "./run/Run";

const App = () => {
	return (
		<HashRouter>
			<Header />
			<Routes>
				<Route path="/run" element={ <Run /> } />
				<Route path="*" element={ <Home /> } />
			</Routes>
		</HashRouter>
	);
};

export default App;
