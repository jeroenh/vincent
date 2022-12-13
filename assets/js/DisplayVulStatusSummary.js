
import React from 'react';
import DisplayVulStatus from "./DisplayVulStatus";


const DisplayVulStatusSummary = (props) => {
    const { status } = props;

    return (
        <>                                                                                                           
            {status.map((b, index) => {
                return (
                    <DisplayVulStatus
                        key={`${b.status}-${index}`}
                        status={b.status}
                        count={b.count}
                    />
                );
            })}                                                                                                      
        </>
    );
};

export default DisplayVulStatusSummary;
