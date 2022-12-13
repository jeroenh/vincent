import React, { useState, useEffect } from 'react';
import CompContext from './CompContext';
import ComponentAPI from './ComponentAPI';

const componentapi = new ComponentAPI();

const UserProvider = ({ children }) => {

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
	const fetchUser = async () => {
            try {
		setLoading(true);
		await componentapi.getUser().then(response => {
		    setUser(response);
		});
            } catch (error) {
		console.error('Error fetching user:', error);
            } finally {
		setLoading(false);
            }
	};
	
	fetchUser();
    }, []);
    
    return (
	<CompContext.Provider value={{ user, setUser, loading }}>
            {children}
	</CompContext.Provider>
    );
};

export default UserProvider;
