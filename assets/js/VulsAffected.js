import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
    Card,
    Modal,
    Table,
    Alert,
    OverlayTrigger,
    Tooltip,
    DropdownButton,
    Dropdown,
    Accordion,
    Row,
    Col,
    Button,
} from "react-bootstrap";
import ClickCellTable from "Components/ClickCellTable";
import DisplayVulStatus from "Components/DisplayVulStatus";
import { useNavigate, useSearchParams } from "react-router";


const VulsAffected = (props) => {

    let [searchParams, setSearchParams] = useSearchParams();
    const [sort, setSort] = useState({direction: 'none', accessor: 'none'});
    const [tableState, setTableState] = useState({hiddenColumns: ["edit"], vulId: props.vul?.id || 0});
    const [data, setData] = useState([]);
    
    const navigate = useNavigate();

    
     const columns = useMemo(
        () => [
	     {
                Header: 'vendor',
		accessor: 'vendor',

            },
	    {
		Header: 'product',
		accessor: 'product',
	    },
	    {
                Header: 'status',
                id: 'status',
                accessor: 'status',
                Cell: props => (
                    <>
                        {props.row.original.status.map((status, index) => (
			    <div className="d-flex align-items-start gap-3" key={`status-${props.row.id}-${index}`}>
				<DisplayVulStatus
				    status={status.status}
				/>

				<span className="fw-500">{
                                    status.version_value
                                }{" "}                                                               
                                    {status.version_range
                                     ? status.version_range
                                     : ""}{" "}                                                       
                                    {status.version_end_range
                                     ? status.version_end_range
                                     : ""}{" "}
				</span>
			    </div>
			))}
		    </>
                ),
            },
	    {
		Header: 'edit',
		id: 'edit',
		accessor: 'edit',
		Cell: ({row, column, table})=> (
		    <Button onClick={(e)=>updateStatus(row.original.component, row.original.vul)} title="Edit Status" variant="btn-icon px-1">
                    <i className="fas fa-edit"></i></Button>
		)
	    },
	],
	 []
     )


    const updateStatus = (comp, id) => {

	setSearchParams((searchParams) => {
	    searchParams.set("activeTab", "addstatus");
	    searchParams.set("component", comp);
	    searchParams.set("vul", id);
	    return searchParams;
	});
	props.hideModal();
    }

    
    useEffect(() => {

	if (props.vul) {
	    
	    let newdata = [...props.vul.affected_products]
	    
	    if (props.user?.roles.length > 0) {
		setTableState(null);
	    }
	    
	    newdata.forEach(x => {
		x['vul'] = props.vul.id;
	    });
	    
	    setData(newdata);
	}
	
    }, [props.vul]);


    return (
	data.length > 0 ?

         <Modal show={props.showModal} onHide={props.hideModal} size="xl" centered backdrop="static">
             <Modal.Header closeButton className="border-bottom">
                 <Modal.Title>Affected Products</Modal.Title>
             </Modal.Header>
             <Modal.Body>
		 <ClickCellTable
                     columns = {columns}
                     data = {data}
                     hasMore = {false}
                     sort = {sort}
                     onClickFunction = {null}
                     initialState = {props.tableState || []}
                 />
	     </Modal.Body>

	     <Modal.Footer>
	     </Modal.Footer>

	 </Modal>
	 :
	 ""
     )


}
export default VulsAffected;
