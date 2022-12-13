import {AsyncTypeahead} from 'react-bootstrap-typeahead';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ThreadAPI from './ThreadAPI';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import '../css/casethread.css';

const CACHE = {};

const PER_PAGE = 50;

const caseapi = new ThreadAPI();

const ActiveIndexWatcher = ({ update }) => {
    useEffect(update);
    return null;
};

function makeAndHandleRequest(query, page = 1) {
    let q = `search=${query}`;
    return caseapi.searchCases(q).then((response) => {
	console.log(response.results);
        let items = response.results;
        let total_count = response.count;
        const options = items.map((i) => ({
            title: i.title,
            id: i.case_id,
	    case_id: i.case_identifier
	    
        }));
        return {options, total_count};
    });
}

const CaseTypeahead = (props) => {

    /* typeahead vars */
    const [suggested, setSuggested] = useState([]);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [query, setQuery] = useState("");
    const [options, setOptions] = useState([]);
    const [activeIndex, setActiveIndex] = useState(-1);

    const handleSearch = useCallback((q) => {
	if (CACHE[q]) {
            setOptions(CACHE[q].options);
            return;
        }

	if (props.querystr) {
	    q = q.concat(props.querystr);
	}
	
        setIsSearchLoading(true);
        makeAndHandleRequest(q).then((resp) => {
            CACHE[q] = { ...resp, page: 1 };
            console.log("OPTIONS ARE>>>>>>>", resp.options);
            setIsSearchLoading(false);
            setOptions(resp.options);
        });
    }, []);

    const handlePagination = (e, shownResults) => {
	const cachedQuery = CACHE[query];

        // Don't make another request if:
        // - the cached results exceed the shown results
        // - we've already fetched all possible results
        if (
            cachedQuery.options.length > shownResults ||
                cachedQuery.options.length === cachedQuery.total_count
        ) {
            return;
        }

        setIsSearchLoading(true);

	const page = cachedQuery.page + 1;

        makeAndHandleRequest(query, page).then((resp) => {
            const options = cachedQuery.options.concat(resp.options);
            CACHE[query] = { ...cachedQuery, options, page };

            setIsSearchLoading(false);
            console.log("OPTIONS ARE, options");
            setOptions(options);
        });
    };

    const onKeyDown = useCallback(
        (e) => {
	    /*tab or enter */
            if ([13, 9].includes(e.keyCode) && activeIndex === -1) {
		if (e.target.value) {
                    props.setCase([{'case_id': e.target.value}])
		}
            }
        },
        [activeIndex]
    );

    const onBlurFn = (e) => {
	if (props.case.length == 0) {
	    if (e.target.value) {
		props.setCase([{'case_id': e.target.value}])
	    }
	}
    }

    
    return (

	<AsyncTypeahead
	    name="name"
            disabled={props.disabled}
            id="cases"
            options={options}
	    onKeyDown={onKeyDown}
            allowNew={props.allowNew}
	    onBlur={onBlurFn}
            onPagination={handlePagination}
            onSearch={handleSearch}
            paginate
	    filterBy={()=>true}
	    labelKey="case_id"
	    isInvalid={props.invalid}
            isLoading={isSearchLoading}
            onChange={props.setCase}
            selected={props.case}
            useCache={false}
            placeholder="Start typing for cases"
            renderMenuItemChildren={(option) => (
                <div className="d-flex align-items-center gap-2" key={option.case_id}>
                    <span>{option.case_id} {option.title}</span>
                </div>

            )}
	/>
    )
};

export default CaseTypeahead;
