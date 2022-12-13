import React from 'react'
import { useState, useEffect} from 'react';
import { Modal, Alert, Button, Form } from "react-bootstrap";
import CaseThreadAPI from "./ThreadAPI";
import axios from 'axios';
import ResultsList from './ResultsList.js';

const threadapi = new CaseThreadAPI;

const VulCaseLookup = ({ showModal, hideModal, vul }) => {

    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [itemsCount, setItemsCount] = useState(0);
    let cancelToken;
    

    const fetchInitialData = async () => {

	if (typeof cancelToken != typeof undefined) {
            cancelToken.cancel("Operation canceled due to new request.")
        }

	cancelToken = axios.CancelToken.source()
	
	let search = `type=All&page=1&name=${vul.cve_id}`;
	const response = await threadapi.searchAll(search, cancelToken);
        setResults(response.data.data);
	setItemsCount(response.data.count);
        setIsLoading(false);
    }


    useEffect(() => {
	if (vul) {
	    setIsLoading(true);
	    fetchInitialData();
	}
    }, [vul])


    return (
        <Modal show={showModal} onHide={hideModal} centered backdrop="static">
        <Modal.Header closeButton>
            <Modal.Title>{vul?.cve_id} Case Information</Modal.Title>
        </Modal.Header>
	    <Modal.Body>
		{ isLoading ?
		  <div className="text-center">
                      <div className="lds-spinner">
                          <div></div>
                          <div></div>
                          <div></div>
                      </div>
                  </div>
                  :
                  <ResultsList
                      results = {results}
                      count={itemsCount}
                      page={page}
                      setCurrentPage={setPage}
                      emptymessage="No results"
                  />
                }
	    </Modal.Body>
        <Modal.Footer>
	    <Button variant="primary" onClick={hideModal}>
		Ok
	    </Button>
        </Modal.Footer>
      </Modal>
    )
}

export default VulCaseLookup;
