import {AsyncTypeahead} from 'react-bootstrap-typeahead';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ComponentAPI from './ComponentAPI';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import '../css/casethread.css';

const CACHE = {};

const PER_PAGE = 50;

const componentapi = new ComponentAPI();

const ActiveIndexWatcher = ({ update }) => {
    useEffect(update);
    return null;
};

function makeAndHandleRequest(query, page = 1) {
    let q = `search=${query}`;
    return componentapi.getComponents(q).then((response) => {
        let items = response.results;
        let total_count = response.count;
        const options = items.map((i) => ({
            name: i.component.name,
            id: i.component.id,
            owner_name: i.owner ? i.owner.name : "",
	    owner_uuid: i.owner?.uuid,
            versions: i.versions,
	    
        }));
        console.log(options);
        return {options, total_count};
    });
}

const ComponentTypeahead = (props) => {

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
                props.setComponent([{'name': e.target.value}])
            }
        },
        [activeIndex]
    );

    const onBlurFn = (e) => {
	if (props.component.length == 0) {
	    props.setComponent([{'name': e.target.value}])
	}
    }

    
    return (

	<AsyncTypeahead
	    name="name"
            disabled={props.disabled}
            id="components"
            options={options}
	    onKeyDown={onKeyDown}
            allowNew={props.allowNew}
	    onBlur={onBlurFn}
            onPagination={handlePagination}
            onSearch={handleSearch}
            paginate
	    isInvalid={props.invalid}
            isLoading={isSearchLoading}
            labelKey="name"
	    filterBy={["name", "owner_name"]}
            onChange={props.setComponent}
            selected={props.component}
            useCache={false}
            placeholder="Start typing for components"
            renderMenuItemChildren={(option) => (
                <div className="d-flex align-items-center gap-2" key={option.id}>
                    <span>{option.name}</span>
		     {option.owner_name &&
                      <span>({option.owner_name})</span>
                     }      
                </div>

            )}
	/>
    )
};

export default ComponentTypeahead;
