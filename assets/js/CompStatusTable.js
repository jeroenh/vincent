import React, { useState, useEffect, useMemo } from 'react';
import BTable from "react-bootstrap/Table";
import '../css/casethread.css';
import { useTable, useSortBy, useRowSelect } from 'react-table';


const CompStatusTable = ({columns, data, setSelectedRows, updateMyData, vuls}) => {

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
        selectedFlatRows,
        state: {selectedRowIds}
    } = useTable(
        {
            columns,
            data,
	    updateMyData,
        },
        useSortBy,
        useRowSelect,
    );
    
    useEffect(()=>{
        if (selectedFlatRows) {
            setSelectedRows(selectedFlatRows);
        }
    },[
        setSelectedRows,
        selectedRowIds
    ]);

    /*
      console.log(selectedRowPaths);
      console.log(selectedRows);
      setSelectedRows(selectedRowPaths);
      console.log("HERLKJERJ");
      }, [setSelectedRows, selectedRowPaths]);*/
    
    return (
        <BTable className="table" hover {...getTableProps()}>
            <thead>
		{headerGroups.map(headerGroup => (
                    <tr {...headerGroup.getHeaderGroupProps()}>
			{headerGroup.headers.map(column => (
                            <th
				{...column.getHeaderProps(column.getSortByToggleProps(), {style: {minWidth: column.minWidth, maxWidth: column.maxWidth}})}>
                            
				{column.render('Header')}
				{/* Add a sort direction indicator */}
				<span>
				    {column.isSorted
				     ? column.isSortedDesc
				     ? ' 🔽'
				     : ' 🔼'
				     : ''}
				</span>
                            </th>
			))}
                    </tr>
		))}
	    </thead>
	    <tbody
		{...getTableBodyProps()}
            >
                {rows.map((row, i) => {
                    prepareRow(row);
		    const arr = row.original.status;
		    return (
		    arr.map((srow, idx) => {
			return (
			    <tr {...row.getRowProps({status: idx})} key={`row-${i}-${idx}`}>
				{row.cells.map(cell => {
				    return (
					<td
					    {...cell.getCellProps({style: {minWidth: cell.column.minWidth, maxWidth: cell.column.maxWidth}})}>{cell.render('Cell', {status: idx, vuls_available: vuls})}</td>
				    )
				})}
			    </tr>
			)
		    }))
                })}
            </tbody>
        </BTable>
    )
}

export default CompStatusTable;
