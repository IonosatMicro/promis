var DATA = {};

(function(){

    DATA.ez1 = '20110831_2-ez-lf.json';
    DATA.ez2 = '20110905-ez-lf.json';
    DATA.ez3 = '20110914-ez-lf.json';

    DATA.mw1 = 'BeCsv.json';

    DATA.dates = ['2011-08-31', '2011-09-05', '2011-09-14'];

})();

$(document).ready(function(){
    $('.mapblock').css('visibility', 'hidden');
    $('.resultsblock').hide();
    $('.searchresults').hide();

    /* assume orbit is already loaded */

    $('.searchbutton').click(function(){
        /* search by date */
        var intime = false, latlon = false, fparams = false;
        var range = $('.daterange').val().split(' - ');
        var mrange = moment.range(moment(range[0], 'YYYY-MM-DD'), moment(range[1], 'YYYY-MM-DD'));

        $.each(DATA.dates, function(i, d){
            var x = moment(d, 'YYYY-MM-DD');
            intime = x.within(mrange);
        });

        if(intime) {
            var box = map.getBounds();

            $.each(PROMIS.orbit, function(i, ll){
                if(box.contains(ll))
                    latlon = true;
            });

            /* params */
            if(latlon) {
                alert('params left');
            } else {
                $('.resultsblock').show();
                $('.resultscount').html('Nothing has been found');
            }
        }
    });
});

