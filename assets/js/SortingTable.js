import React, { useState, useEffect, useMemo } from 'react';
import BTable from "react-bootstrap/Table";
import {Button, Form, Row, Col} from "react-bootstrap";
import { useTable, useFilters, useRowSelect, useSortBy, useExpanded, usePagination } from 'react-table';
import InfiniteScroll from "react-infinite-scroll-component";

const SortingTable = ({columns, data, update, hasMore, sort, onHeaderClick, onClickFunction, initialState, target, hidden=[]}) => {


    const [selectedRow, setSelectedRow] = useState(null);
    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
	rows,
        prepareRow,
	visibleColumns,
	setHiddenColumns,
	state: {selectedRowIds}
    } = useTable(
        {
            columns,
            data,
	    initialState,
	    manualSortBy: true

        },
        useSortBy,
	useRowSelect
	
    )
    
    const onClickRow = (row) => {
	setSelectedRow(row.id);
	if (onClickFunction) {
	    onClickFunction(row);
	}
    }

    const onColumnClick = (column) => {
	if (onHeaderClick) {
	    onHeaderClick(column);
	}
    }

    useEffect(() => {
	setHiddenColumns(hidden);
    }, [hidden])


    const Filter = ({ column }) => {
	return (
	    <div style={{ marginTop: 5 }}>
		{column.canFilter && column.render("Filter")}
	    </div>
	)
    }

    return (
	    <InfiniteScroll
		dataLength = {rows.length}
		next={update}
		hasMore = {hasMore}
		loader = {<h5 className="mt-3">Loading more...</h5>}
		scrollableTarget={target}
	    >
		<BTable aria-label="Unverified Contact" id="sortingTable" className="table" hover {...getTableProps()}>
		    <thead>
			{headerGroups.map(headerGroup => (
			    <tr {...headerGroup.getHeaderGroupProps()}>
				{headerGroup.headers.map(column => (
				    <th
					{...column.getHeaderProps(column.getSortByToggleProps(), {style: {minWidth: column.minWidth, maxWidth: column.maxWidth}})}
					onClick={() => onColumnClick(column)} >
					{column.render('Header')}
					{/* Add a sort direction indicator */}
					<span>
					    {sort.accessor === column.id ?
					     <>
					     {sort.direction === 'ASC' ? (
						 ' 🔼'
					     ) : sort.direction === 'DESC' ? (
						 ' 🔽'
					     ) : ''}
					     </>
					     : ''
					    } 
					</span>

				    </th>
				))}
			    </tr>
			))}
		    </thead>
		    <tbody
			{...getTableBodyProps()}
		    >
			{(rows.length > 0 && rows.map((row, i) => {
			    prepareRow(row);
			    const rowProps = row.getRowProps();
			    return (
				<React.Fragment key={i}>
				    <tr  {...row.getRowProps()} onClick={() => onClickRow(row)} style={{backgroundColor: row.id != selectedRow ? "transparent" : "#d1d4f1" }} className={row.id == selectedRow ? 'selectedRow': ''}>
					{row.cells.map(cell => {
					    return (
						<td
						    {...cell.getCellProps({style: {minWidth:cell.column.minWidth, maxWidth: cell.column.maxWidth}})}>{cell.render('Cell')}</td>
					    )
					})}
				    </tr>
				</React.Fragment>
			    )
			})) ||  <tr><td colSpan={visibleColumns.length} className="text-center">No data ...</td></tr>}
		    </tbody>
		</BTable>
            </InfiniteScroll>
    )
}


export default SortingTable;
