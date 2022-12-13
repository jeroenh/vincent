import React, { useState, useEffect, useMemo } from 'react';
import BTable from "react-bootstrap/Table";
import {Button, Form, Row, Col} from "react-bootstrap";
import { useTable, useRowSelect, useFilters, useSortBy, useExpanded, usePagination } from 'react-table';
import InfiniteScroll from "react-infinite-scroll-component";

const SubRowTable = ({columns, data, update, hasMore, target, setSelectedRows, showRowExpansion, skipPageResetRef}) => {


    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
	rows,
	selectedFlatRows,
        prepareRow,
	visibleColumns,
	setHiddenColumns,
	state: {selectedRowIds}
    } = useTable(
        {
            columns,
            data,
	    manualSortBy: true,
	    autoResetPage: !skipPageResetRef.current,
            autoResetExpanded: !skipPageResetRef.current,
            autoResetGroupBy: !skipPageResetRef.current,
            autoResetSelectedRows: !skipPageResetRef.current,
            autoResetSortBy: !skipPageResetRef.current,
            autoResetFilters: !skipPageResetRef.current,
            autoResetRowState: !skipPageResetRef.current,

        },
        useSortBy,
	useExpanded,
	useRowSelect
    )

    useEffect(()=>{
        if (selectedFlatRows && setSelectedRows) {
            setSelectedRows(selectedFlatRows);
        }
    },[
        selectedRowIds
    ]);
    
    return (
	    <InfiniteScroll
		dataLength = {rows.length}
		next={update}
		hasMore = {hasMore}
		loader = {<h5 className="mt-3">Loading more...</h5>}
		scrollableTarget={target}
	    >
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
			{(rows.length > 0 && rows.map((row, i) => {
			    prepareRow(row);
			    const rowProps = row.getRowProps();
			    return (
				<React.Fragment key={i}>
				    <tr  {...row.getRowProps()}>
					{row.cells.map(cell => {
					    return (
						<td
						    {...cell.getCellProps({style: {minWidth:cell.column.minWidth, maxWidth: cell.column.maxWidth}})}>{cell.render('Cell')}</td>
					    )
					})}
				    </tr>
				    {row.isExpanded ? (
					showRowExpansion({ row, rowProps, visibleColumns })
				    ) : null}                                                                   
				</React.Fragment> 
			    )
			})) ||  <tr><td colSpan={visibleColumns.length} className="text-center">No data ...</td></tr>}
		    </tbody>
		</BTable>
            </InfiniteScroll>
    )
}


export default SubRowTable;
