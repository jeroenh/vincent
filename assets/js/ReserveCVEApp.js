import React, { useState, useEffect, useMemo } from 'react';
import {Nav, OverlayTrigger, Tooltip, Dropdown, DropdownButton, InputGroup, CardGroup, Alert, Button, Tab, Tabs, Row, Form, Card, Col} from 'react-bootstrap';
import { format } from "date-fns";
import AdminAPI from './AdminAPI'
import GenericTable from './GenericTable';
import VulCaseLookup from './VulCaseLookup';

const adminapi = new AdminAPI();

const ReserveCVEApp = (props) => {


    const [reserved, setReserved] = useState([]);
    const [apiError, setApiError] = useState(null);
    const [lookupVul, setLookupVul] = useState(null);
    const [showCaseLookupModal, setShowCaseLookupModal] = useState(false);    


    const hideLookupModal = () => {
	setShowCaseLookupModal(false);
    };
			      


    const fetchInitialData = async() => {
	adminapi.getCVEReservations(props.account?.id).then((response) => {
	    setReserved(response);
        }).catch(err => {
            setApiError(err.message);
        });

    }


    useEffect(() => {

	if (props.account) {
	
	    fetchInitialData();
	}

    }, [props]);

    const viewCase = (props) => {
        setLookupVul(props.row.original);
        setShowCaseLookupModal(true);
        console.log(props);
    }
    

    const cveColumns = useMemo(
        () => [
            {
                Header: 'CVE',
                accessor: 'cve_id'
            },
            {
                Header: 'Reserved Date',
                id: 'time_reserved',
		accessor: (d) =>
                    d.time_reserved &&
                    format(new Date(d.time_reserved), "yyyy-MM-dd HH:mm"),
            },
	    {
		Header: 'Vul',
		id: 'case',
		accessor: 'case',
		Cell: props => { return props.row.original.case?.url && <a className="btn btn-outline-primary btn-xs" href={`${props.row.original.case.url}?activeTab=addvuls&cve=${props.row.original.cve_id.slice(4)}`} target="_blank"><i className="fas fa-briefcase pe-1"></i>{props.row.original.case.case_id}</a>
			       }
	    },
	    {
                Header: 'Case',
                accessor: 'lookup',
                Cell: props => (<Button variant="outline-primary" size="xs" onClick={()=> viewCase(props)}><i className="fas fa-search-plus pe-1"></i>Lookup</Button>)
            }

	], []
    );
    
    
    

    return (


	<Card className="mb-4">
            <Card.Header as="h5">
		<Card.Title>CVEs reserved by you</Card.Title>
	    </Card.Header>

	    <Card.Body>
               <VulCaseLookup
                   showModal = {showCaseLookupModal}
                   hideModal = {hideLookupModal}
                   vul={lookupVul}
               />   		

		<GenericTable
		    columns={cveColumns}
		    data={reserved}
		/>

	    </Card.Body>
	</Card>

    )
}

export default ReserveCVEApp;
