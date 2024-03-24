import React from 'react';
import { Link } from "react-router-dom";

const Header = () => {
	return (
		<div className="header-wrapper">
			<div className="header">
				<Link to="/" className="header-logo">audio-dev</Link>
				<div className="header-links">
					<Link to="/run">Run</Link>
				</div>
			</div>
		</div>
	);
};

export default Header;
