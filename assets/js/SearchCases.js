import React, { useState, useEffect, useMemo } from 'react';
import CaseThreadAPI from './ThreadAPI';
import {Row, Alert, Card, Col, Button} from 'react-bootstrap';
import SearchFilter from './SearchFilter.js';
import ApprovalList from './ApprovalList.js';
import axios from 'axios';

const caseapi = new CaseThreadAPI();
import CaseList from './CaseList.js';


const SearchCases = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [cases, setCases] = useState([]);
    const [meta, setMeta] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsCount, setItemsCount] = useState(0);
    const [searchVal, setSearchVal] = useState("");
    const [searchOwners, setSearchOwners] = useState(["All"]);
    const [searchStatus, setSearchStatus] = useState(["0", "1"]);
    const [error, setError] = useState(null);
    const [approvals, setApprovals] = useState([]);
    let cancelToken;
    
    const searchCaseFn = async(val, owners, status, page) => {

	setIsLoading(true);
	let urlstr = "";
	if (val) {
	    let sv = encodeURIComponent(val);
	    urlstr = `search=${sv}`
	}
	owners.map((item) => item != "All" ? urlstr = `${urlstr}&owner=${item}` : "")
	status.map((item) => urlstr = `${urlstr}&status=${item}`)

	urlstr = `${urlstr}&page=${page}`;


	if (typeof cancelToken != typeof undefined) {
            cancelToken.cancel("Operation canceled due to new request.")
        }

        cancelToken = axios.CancelToken.source()
	
	await caseapi.searchCases(urlstr, cancelToken).then((response)=> {
	    setError(null);
	    setCases(response.results);
	    setItemsCount(response.count);
	    setIsLoading(false);
	}).catch(err => {
	    console.log(err);
            setError(`Error fetching new cases: ${err.message}`);
            setIsLoading(false);
	});
    }
    
    // Searchbar functionality
    const onSearchbarChange = (e, field) => {
	setCurrentPage(1);
	const value = e.target.value
	if (field == "search") {
	    setSearchVal(e.target.value);
	    searchCaseFn(e.target.value, searchOwners, searchStatus, 1);
	}else if (field == "owner") {
	    let newowners = [];
	    if (e.target.checked) {
		if (e.target.value == "All") {
                    meta.users?.map((u) => {newowners.push(u.uuid.toString())})
		    newowners.push("0");
		    newowners.push("All");
		    setSearchOwners(newowners);
		} else {
		    newowners = [...searchOwners, value];
		    setSearchOwners(newowners);
		}
		    //setSearchOwners(searchOwners => [...searchOwners, value])
	    } else {
		newowners = searchOwners.filter((item) => (item !== value && item != "All"));
		setSearchOwners(newowners);
	    }
	    searchCaseFn(searchVal, newowners, searchStatus, 1);
	}else if (field == "status") {
	    let newstatus;
	    if (e.target.checked) {
                //setSearchStatus(searchStatus => [...searchStatus, value])
		newstatus = [...searchStatus, value];
		setSearchStatus(newstatus);
	    } else {
                newstatus = searchStatus.filter((item) => item !== value);
		setSearchStatus(newstatus);
            }
	    searchCaseFn(searchVal, searchOwners, newstatus, 1);
	}
    }

    const fetchInitialData = async() => {
	await caseapi.getCaseMetadata().then((response) => {
	    setMeta(response);
	    setApprovals(response.approvals);
	}).catch(err => {
	    setError(`API Error: ${err.message}`);
	    console.log(err);
	});
    }

    
    useEffect(() => {

	fetchInitialData();
	    
	
    }, [])
    
    useEffect(()=> {
	searchCaseFn("", searchOwners, searchStatus, currentPage);
	//paginationHandler(currentPage);
    }, [currentPage])
    
    
    const paginationHandler = async (page) => {
        await caseapi.getCasesByPage(page).then((response) => {
	    setCases(response.results);
	    setItemsCount(response.count);
	    setIsLoading(false);
        }).catch(err => {
	    console.log(err);
	    setError(`Error fetching new cases: ${err.response}`);
	    setIsLoading(false);
	});
    }

    return (
	<>
	    <div className="d-flex justify-content-between align-items-center">
		<h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Cases /</span> Search</h4>
		{meta?.users?.length > 0 &&
		 <Button variant="primary" href="/cvdp/case/new/"><i className="fas fa-plus"></i>{" "}New Case</Button>
		}
	    </div>
	    
	<Row>
            <Col lg={approvals.length > 0 ? 8 : 12}>
                <Card>
                    <Card.Header>
                        <SearchFilter
			    onChange={onSearchbarChange}
			    value=""
			    owner={meta?.users || []}
			    status={meta?.status || []}
			    teams={meta?.teams || []}
			    searchOwners = {searchOwners}
			    searchStatus = {searchStatus}
			/>
			{isLoading ? ""
			 :
			 <div className="mt-2 text-muted">
			     <i>{itemsCount} cases</i>
			 </div>
			}
			    
                    </Card.Header>
                    <Card.Body>
			{error &&
			 <Alert variant="danger">{error}</Alert>
			}
			{ isLoading ?
			  <div className="text-center">
                              <div className="lds-spinner"><div></div><div></div><div></div></div>
                          </div>
			  :
			  <CaseList
			      cases={cases}
			      count={itemsCount}
			      onSearchBarChange={onSearchbarChange}
			      page={currentPage}
			      setCurrentPage={setCurrentPage}
			      emptymessage="You have no cases"
			      crumbs = {["Cases", "Search"]}
			      crumb_link="/cvdp/cases/"
			      states={meta?.states}
			  />
			}
		    </Card.Body>
                </Card>
            </Col>
	    {approvals.length > 0 &&
	     <Col lg={4}>
		  <Card>                                                                                                                                 
                      <Card.Header as="h5">
			  <Card.Title>Approvals Requested</Card.Title>
		      </Card.Header>
		      <Card.Body>
			  <ApprovalList
			      approvals={approvals}
			      crumbs = {["Cases", "Search"]}
                              crumb_link="/cvdp/cases/"
			      states={meta?.states}
			  />
		      </Card.Body>
		  </Card>
	     </Col>
	    }
	     
        </Row>
	</>
    )
}

export default SearchCases;
