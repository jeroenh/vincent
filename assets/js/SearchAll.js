import React, { useState, useEffect, useMemo } from 'react';
import CaseThreadAPI from './ThreadAPI';
import { useSearchParams } from "react-router";
import {Row, Alert, Nav, Card, InputGroup, Col, Button, Form} from 'react-bootstrap';
import axios from 'axios';
const caseapi = new CaseThreadAPI();

import ResultsList from './ResultsList.js';

const SearchAll = () => {

    const [searchParams, setSearchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [itemsCount, setItemsCount] = useState(0);
    const [searchVal, setSearchVal] = useState(searchParams.get("q") || "");
    const [searchType, setSearchType] = useState("All");
    const [results, setResults ] = useState([]);
    const [error, setError] = useState(null);
    const [start, setStart] = useState(false);
    const [showAll, setShowAll] = useState(false);
    
    let cancelToken;

    const doSearch = async (search) => {

	//Check if there are any previous pending requests
	if (typeof cancelToken != typeof undefined) {
	    cancelToken.cancel("Operation canceled due to new request.")
	}

	cancelToken = axios.CancelToken.source()
	try {
	    const response = await caseapi.searchAll(search, cancelToken);
	    setResults(response.data.data);
	    setItemsCount(response.data.count);
	    setIsLoading(false);
	} catch (err) {
	    setError(`An error occurred: ${err.message}`);
	}

    };


    useEffect(() => {
	setError(null);
	let sval = encodeURIComponent(searchVal);
        let urlstr = `type=${searchType}&page=${page}`;
        if (sval) {
            urlstr = `${urlstr}&name=${sval}`;
	    doSearch(urlstr);
	    setStart(true);
        } else if (start) {
	    /* don't search on initial mount */
	    doSearch(urlstr);
	} else {
	    setIsLoading(false);
	}

    }, [searchType, searchVal, page]);


    const onFilter = (e) => {
        setSearchVal(e.target.value);
        setIsLoading(true);
    }


    useEffect(() => {

	if (document.getElementById('viewall')) {
	    setShowAll(true);
	} else {
	    setShowAll(false);
	}

    }, []);
    
    return (
        <Row>
            <Col lg={8}>
		{error &&
		 <Alert variant="danger">{error}</Alert>
		}
		 
                <Card>
                    <Card.Header className="pb-0">
                        <div className="d-flex align-items-start justify-content-between mt-2 gap-5">
			    <Nav defaultActiveKey="all">
				<Nav.Item>
                                    <Nav.Link eventKey="all" href="#" onClick={(e)=>(e.preventDefault(), setSearchType("All"))} className="nav-item nav-link">All</Nav.Link>
				</Nav.Item>
				<Nav.Item>
                                    <Nav.Link eventKey="cases"  href="#" onClick={(e)=>(e.preventDefault(), setSearchType("Cases"))} className="nav-item nav-link">Cases</Nav.Link>
				</Nav.Item>
				<Nav.Item>
                                    <Nav.Link eventKey="components" href="#" onClick={(e)=>(e.preventDefault(), setSearchType("Components"))} className="nav-item nav-link">Components</Nav.Link>
                                </Nav.Item>

				{showAll &&
				 <>
				     <Nav.Item>
					 <Nav.Link eventKey="contacts" href="#" onClick={(e)=>(e.preventDefault(), setSearchType("Contacts"))} className="nav-item nav-link">Contacts</Nav.Link>
				     </Nav.Item>
				     
				     <Nav.Item>
					 <Nav.Link eventKey="tickets" href="#" onClick={(e)=>(e.preventDefault(), setSearchType("Tickets"))} className="nav-item nav-link">Tickets</Nav.Link>
				     </Nav.Item>
				 </>
				}
                            </Nav>
                        </div>
                    </Card.Header>
                    <Card.Body>

			<InputGroup className="w-100">
                            <Form.Control
                                placeholder="Search VINCE-NT"
                                aria-label="Search VINCE-NT"
				value={searchVal}
                                onChange={(e)=>onFilter(e)}
                            />
                            <Button variant="btn btn-outline-secondary" id="button-addon2" type="submit">
                                <i className="fas fa-search" title="Perform search"></i>
                            </Button>
                        </InputGroup>

                    </Card.Body>
                </Card>
		<Card className="mt-4">
                    <Card.Body>
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
		    </Card.Body>
                </Card>
            </Col>
        </Row>
    )
}

export default SearchAll;
