import React, { useState, useEffect } from 'react';
import { format, formatDistance } from 'date-fns';
import DisplayLogo from './DisplayLogo';

const ActivityApp = (props) => {

    let created = new Date(props.activity.created);
    let timeago = formatDistance(created, new Date(), {addSuffix: true});


    const displayVal = (val) => {
	let jsonval = val.replaceAll("'", "\"");	

	try {
	    jsonval = JSON.parse(jsonval);
	} catch {
	    return <span>{val}</span>;
	}

	if (Array.isArray(jsonval)) {
	    return (
		<>
		    {jsonval.map((x, idx) => {
			if (typeof x === 'object') {
			    return (
				<React.Fragment key={`aa-${idx}`}>
				    {Object.entries(x).map(([k, v], i) => (
					<div key={`oa-${idx}-${i}`}>{k}: {v}</div>
				    ))}
				</React.Fragment>
			    )
			} else {
			    return (
				<div key={`a-${idx}`}>{x}</div>
			    )
			}
		    })}
		</>
	    )
	} else if (typeof val === "object") {
	    return (
		<>
		    {Object.entries(x).map(([k, v], i) => (
			<div key={`o-${idx}-${i}`}>{k}: {v}</div>
		    ))}
		</>
	    )
	} else {
	    if (val) {
		return (<span>{val}</span>);
	    } else {
		return "None"
	    }
	}

    }
    



    
    return (
	<>
	<div className="d-flex align-items-center justify-content-between activity-item">
	    <div className="d-flex align-items-center gap-2">
		<DisplayLogo
		    photo = {props.activity.user?.photo}
		    color = {props.activity.user?.logocolor}
		    name= {props.activity.user?.name}
		/>
		<p><b>{props.activity.user?.name}</b> {props.activity.title}</p>
	    </div>
        </div>
	    {props.activity.comment &&
	     <div className="bold-mx">
		 { props.activity.comment }
	     </div>
	    }
	    
	{props.activity.change &&
         <div className="bold mx-2">
             {props.activity.change.map((change, index) => {
                 if (change.old_value && change.new_value) {

		     return (
                         <div key={`change-${index}`} className="small font-detail">Changed {change.field} from <b>{displayVal(change.old_value)}</b> to <b>{displayVal(change.new_value)}</b></div>)
                 } else if (change.old_value) {
                     return (
                         <div key={`change-${index}`} className="small font-detail">Removed {change.field}: <b>{displayVal(change.old_value)}</b></div>)
                 } else {
                     return (
                         <div key={`change-${index}`} className="small font-detail">Added {change.field}: <b>{displayVal(change.new_value)}</b></div>)
                 }
             })}
         </div>
	}                                                              
            <div className="small  mt-1"><i className="fas fa-clock" />	{' '}{format(created, 'yyyy-MM-dd H:mm:ss ')} ({timeago})</div>
	</>
    )
}

export default ActivityApp;
