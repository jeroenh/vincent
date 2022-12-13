import React from 'react';
import { Table, Modal, Alert, Badge, FloatingLabel, Button, InputGroup, Form, Row, Col } from "react-bootstrap";
import { useCallback, useMemo, useState, useEffect } from 'react';
import AdminAPI from 'Components/AdminAPI.js'
import 'Styles/casethread.css';
import StandardPagination from "Components/StandardPagination";
import SubRowTable from "Components/SubRowTable";
import { useLocation, useNavigate, Link } from "react-router";

const adminapi = new AdminAPI;

const CWESearch = (props) => {

    const [cweResults, setCWEResults] = useState(null);
    const [searchVal, setSearchVal] = useState("");
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [data, setData] = useState([]);
    const [cwe, setCWE] = useState(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const skipPageResetRef = React.useRef()

    
    const IndeterminateCheckbox = React.forwardRef(
        ({ indeterminate, ...rest }, ref) => {
            const defaultRef = React.useRef()
            const resolvedRef = ref || defaultRef

            React.useEffect(() => {
                resolvedRef.current.indeterminate = indeterminate
            }, [resolvedRef, indeterminate])

            return (
                <>
                    <input type="checkbox" ref={resolvedRef} {...rest} />
                </>
            )
        }
    )

    const getUsageColor = (usage) => {
        switch (usage) {
        case 'Allowed':
            return 'success';
        case 'Discouraged':
            return 'warning';
        case 'Prohibited':
            return 'danger';
	default:
            return 'info';
        }
    }


    function SubRow({row, rowProps, visibleColumns, data}) {
	return (
            <>                                                                                      
                {data.map((x, i) => {
                    return (
                        <tr key={`${rowProps.key}-expanded-${i}`} className="text-center">
                            <td colSpan={visibleColumns.length} className="text-center noborder">   
				{x}
                            </td>                                                                   
                        </tr>
                    );
		})}
	    </>
	)
    }
    
    const showChildren = React.useCallback(
	({ row, rowProps, visibleColumns }) => (
	    <SubRow
		row = {row}
		rowProps = {rowProps}
		visibleColumns={visibleColumns}
		data={row.original.children}
	    />
	),
	[]
    );
    
   
    const columns = useMemo(
        () => [
	    {
		id: "selection",
                // The header can use the table's getToggleAllRowsSelectedProps method
                // to render a checkbox
                Header: ({ getToggleAllRowsSelectedProps }) => (
                    <div>
                        <IndeterminateCheckbox {...getToggleAllRowsSelectedProps()} />
                    </div>
                ),
                // The cell can use the individual row's getToggleRowSelectedProps method
                // to the render a checkbox
                Cell: ({ row }) => (
                    <div>
                        <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />
                    </div>
                )
            },
	    {
                Header: "CWE-ID",
		id: "cweid",
                accessor: (d) => {
		    return (
                        <div className="cwe-table-row">
			    {d.cwe}
			</div>
		    )
		},
		maxWidth: 500
            },
            {
                Header: "Notes",
		accessor: (d) => {
		    return (
			<div className="d-flex gap-2 align-items-center">
			    <Badge bg={getUsageColor(d.usage)} pill>{d.usage}</Badge>
			    {d.slice_1003 &&
			     <Badge bg="secondary">NVD</Badge>
			    }
			</div>
		    )},
		id: "notes"
            },
            {
                Header: "Description",
		maxWidth: 400,
		accessor: (d) => {
                    return (
                        <div className="cwe-table-row">
                            {d.description}
                        </div>
		    )
                },
                id: "description"
            },
	    {
                Header: "Children",
		accessor: 'children',
		Cell: props => (
		    <>
		    {props.row.original.children.length > 0 ?                                      
                         <span {...props.row.getToggleRowExpandedProps()}>                          
                             {props.row.isExpanded ?                                                
                              <Button variant="secondary" size="xs"><i className="fas fa-angle-down"></i>  Hide</Button> : <Button variant='secondary' size="xs"><i className="fas fa-angle-right"></i>  Show {props.row.original.children.length} Children  </Button>}                                               
                         </span>
		     :
		     "No children"
		    }
		    </>
		),
                id: "children"
            },
	],
	[]
    );

    /*
    function handleSelectedRows(rows) {
        setSelectedRows(rows);
	let cpes = rows.map((item) => item.original.cpe);
	props.select(cpes);
    }
    */

    const onKeyDown = (e) => {
        if (e.key === "Enter") {
            searchCWEs();
        }
    }

    const searchCWEs = async () => {
        let keyquery = encodeURIComponent(searchVal);
        let q = `page_size=100&search=${keyquery}&page=${currentPage}`;
	await adminapi.getCWEs(q).then((response) => {
	    console.log(response);
            setCWEResults(response);
	    setData(response.results);
        }).catch(err => {
            console.log(err);
	});

    }

    useEffect(() => {
	if (searchVal) {
	    searchCWEs();
	}
    }, [currentPage]);


    const fetchNextData = async () => {
        console.log("fetching...");
	skipPageResetRef.current = true
        await adminapi
            .getNextCWEs(cweResults.next)
            .then((response) => {
                setCweResults(response);
                setData(data.concat(response.results));
            })
            .catch((err) => {
                console.log("data doesn't span multiple pages");
            });
    };


    const clickRow = (row) => {
	setLoading(true);
        setCWE(row);
    };


    return (
	<Row className={"mb-1 " + (props.hide ? "hidden" : "")}>
	    <Col lg={12}>
		<Form.Label>Keyword Search</Form.Label>
		<InputGroup className="mb-3">
		    <Form.Control
			placeholder="Search CWEs"
			aria-label="Search CWEs"
			aria-describedby="searchcpws"
			value={searchVal}
			onChange={(e) =>
                            setSearchVal(e.target.value)
			}
			name="searchcwe"
			onKeyPress={(e) => onKeyDown(e)}
                    />

		    <Button
			variant="btn btn-outline-secondary"
			id="button-addon2"
			onClick={(e) => searchCWEs()}
                    >
			<i className="fas fa-search"></i>
                    </Button>
		</InputGroup>
		<p>Found {cweResults?.count || 0} CWEs</p>

		<SubRowTable
		    columns={columns}
		    data={data}
		    update={fetchNextData}
                    hasMore={
			cweResults &&
                            cweResults.next && !props.target
                            ? true
                            : false
                    }

		    showRowExpansion={showChildren}
		    target={props.target}
		    setSelectedRows = {props.selectRows ? props.selectRows : null}
		    skipPageResetRef = {skipPageResetRef}
		/>
		{props.target && cweResults?.next &&
		 <Button variant="primary" onClick={(e)=>fetchNextData()}>Load More</Button>
		}

	    </Col>
	</Row>
    )
}

export default CWESearch;
