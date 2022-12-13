import React from 'react';
import { useCallback, useState, useEffect } from 'react';
import AdminAPI from 'Components/AdminAPI.js'
import CWESearch from './CWESearch.js';
import { Modal, Button } from "react-bootstrap";


const AddCweModal = (props) => {


    const [buttonDisabled, setButtonDisabled] = useState(false);
    const [selectedCWE, setSelectedCWE] = useState([]);


    function handleSelectedRows(rows) {
        if (rows) {
            let cwes = rows.map((item) => item.original.cwe);
            setSelectedCWE(cwes);
        }
    }


    const submitCWE = () => {

	props.hideModal(selectedCWE);
    }
    
    return (

	
	<Modal show={props.showModal} onHide={props.hideModal} size="xl"  centered backdrop="static" fullscreen="true" id="mDiv">
            <Modal.Header closeButton className="border-bottom">
                <Modal.Title>Search CWEs</Modal.Title>
            </Modal.Header>
            <Modal.Body>

		<div className="tableWrap">                                                         
                    {selectedCWE.length > 0 &&
                     <div>                                                                          
                         <b>Selected CWEs:</b>                                                      
                         <ul>                                                                       
                             {selectedCWE.map((c, idx) => (
                                 <li key={`sel-cpe-${idx}`}>{c}</li>
                             ))}                                                                    
                         </ul>                                                                      
                     </div>
                    }         
		    
		    <CWESearch
			target="mDiv"
			selectRows = {handleSelectedRows}
                    />
		</div>
	    </Modal.Body>
	    <Modal.Footer>
		<div className="d-flex justify-content-end gap-2 mt-3">                             
                    <Button variant="secondary" onClick={(e)=>props.hideModal()}>                   
                    Cancel</Button>                                                                 
                    <Button disabled={buttonDisabled} variant="primary" type="submit" onClick={(e)=>submitCWE()}>
                    Submit</Button>                                                                 
		</div>
            </Modal.Footer>
        </Modal>
    );
}

export default AddCweModal;
