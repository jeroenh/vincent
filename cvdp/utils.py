
#from pinax-messages
from functools import wraps
from django.conf import settings
import re
import shlex
from dateutil.relativedelta import relativedelta
from datetime import date


def get_months_in_range(start_date, end_date):
    """
    Generates a list of (year, month) tuples for each month in the time range (inclusive).
    """
    months_list = []
    current_date = start_date
    # Adjust start date to the first day of its month for consistent iteration
    current_date = current_date.replace(day=1) 
    
    while current_date <= end_date:
        months_list.append(f'{current_date.month:02d}-{current_date.year}')
        # Add one month using relativedelta
        current_date += relativedelta(months=+1)
        
    return months_list


def cached_attribute(func):
    cache_name = "_%s" % func.__name__

    @wraps(func)
    def inner(self, *args, **kwargs):
        if hasattr(self, cache_name):
            return getattr(self, cache_name)
        val = func(self, *args, **kwargs)
        setattr(self, cache_name, val)
        return val
    return inner


def process_query(s, live=True):
    query = re.sub(r"[!'()|&<>]", ' ', s).strip()
    # get rid of empty quotes                                                               
    query = re.sub(r'""', '', query)
    if query == '"':
        return None
    if query.startswith(settings.CASE_IDENTIFIER):
        query = query[len(settings.CASE_IDENTIFIER):]

    if query:
        #sub spaces between quotations with <->                                             
        #if re.search(r'\"', query) and not re.search(r'\".*\"', query):                    
        try:
            query = '&'.join(shlex.split(query))
        except ValueError:
            query = query + '"'
            query = re.sub(r'\s+', '&', query)
        query = re.sub(r'\s+', '<->', query)
        # Support prefix search on the last word. A tsquery of 'toda:*' will                
        # match against any words that start with 'toda', which is good for                 
        # search-as-you-type.                                                               
        if query.endswith("<->"):
            query = query[:-3]
    if query and live:
        query += ':*'

    return query


def get_verslike_range(start, comparator, end):

    if (start == '0' or start == '*'):
        return f"{comparator}{end}"

    if (end == '0' or end == '*'):
        if (comparator == "<"):
            return f">{start}"
        else:
            return f">={start}"

    #full range e.g. 1.9<3.2 should be >=1.9|<3.2

    if (comparator == "<"):
        return f">={start}|<{end}"
    else:
        return f">={start}|<={end}"
            



def json_post_serializer(x):

    ret = ""

    if isinstance(x, str):
        return x
        
    if x.get("text"):
        return x["text"]

    children_str = ""
    children = []
    if x.get("children"):
        for y in x["children"]:
            children.append(json_post_serializer(y))
        children_str = ' '.join(children)

    if x.get('type') == "image":
        url = x.get('url')
        filename = x.get('alt', url)
        ret = f"[{filename}](image file)"
        return ret
    if x.get('type') == "link":
        url = x.get("href")
        return f"[{children_str}]({url}]"
    
    return children_str
    


def post_serializer(content):

    pp_post = ""

    if content and isinstance(content, list):
        for x in content:
            pp_post = pp_post + json_post_serializer(x)
        
    return pp_post
