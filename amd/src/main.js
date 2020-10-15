// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Javascript to initialise the block.
 *
 * @package   block_tepuyeditor
 * @copyright 2020 David Herney @ BambuCo
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define(['jquery', 'core/modal_factory', 'core/modal_events', 'core/templates', 'core/notification', 'core/ajax'],
    function ($, ModalFactory, ModalEvents, Templates, Notification, Ajax) {

        var wwwroot = M.cfg.wwwroot;

        var loadrecord = function (record, template) {

            var re, newvalue;

            for (var i in record) {
                if (record.hasOwnProperty(i)) {
                    re = new RegExp('\\[\\[' + i + '\\]\\]', "g");
                    newvalue = record[i] ? record[i] : '';
                    template = template.replace(re, newvalue);
                }
            }

            return template;
        };

        /**
         * Initialise all.
         *
         */
        var init = function (dataviewid, cancreatetepuy) {

            var $listtemplate = $('#dataview-tpl-itemlist');
            var $singletemplate = $('#dataview-tpl-itemsingle');
            var $recordsboard = $('.dataview-board .records');
            var $createmessage = $('#dataview-tpl-createmessage');
            var createmessagemodal = null;
            var $currentopenlink = null;

            $('.filter-box .one-filter').each(function() {
                var $_this = $(this);
                $_this.find('.filter-head').on('click', function() {
                    $_this.toggleClass('opened');
                });

            });

            // Modal to create an external tepuy object.
            ModalFactory.create({
                body: $createmessage.html(),
                type: ModalFactory.types.SAVE_CANCEL
            })
            .then(function(modal) {

                createmessagemodal = modal;

                modal.getModal().addClass('mod_dataview-message-modal');
                modal.setSaveButtonText(M.str.mod_dataview.goto);

                // Confirmation only.
                modal.getRoot().on(ModalEvents.save, function() {
                    if ($currentopenlink) {
                        $("<a>").prop({
                            target: "_blank",
                            href: $currentopenlink.attr('href')
                          })[0].click();
                    }
                });

                // Confirming, closing, or cancelling will destroy the modal and return focus to the trigger element.
                modal.getRoot().on(ModalEvents.hidden, function() {
                    $currentopenlink = null;
                });
            });

            // Promise to get a directory content.
            $('.filter-box .filter-btn').on('click', function () {

                var q = $('#fulltext-query').val();
                var filters = [];

                $('.one-filter').each(function() {
                    var $one = $(this);
                    $one.find('input[type="checkbox"]:checked:enabled').each(function() {
                        var $control = $(this);
                        var filter = {
                            "key": $control.attr('name'),
                            "value": $control.val()
                        };

                        filters.push(filter);
                    });

                    $one.find('select').each(function() {

                        var $control = $(this);

                        $control.find('option:selected').each(function() {
                            var filter = {
                                "key": $control.attr('name'),
                                "value": $(this).val()
                            };

                            if (filter.value != '') {
                                filters.push(filter);
                            }
                        });

                    });

                    $one.find('input[type="text"]').each(function() {

                        var $control = $(this);
                        var filter = {
                            "key": $control.attr('name'),
                            "value": $control.val()
                        };

                        filters.push(filter);
                    });
                });

                $recordsboard.empty().addClass('loading');

                // Clear special characters used by original data module.
                filters.forEach(element => {
                    element.key = element.key.replace('f_', '');
                    element.key = element.key.replace('[]', '');
                });

                Ajax.call([{
                    methodname: 'mod_dataview_query',
                    args: { 'id': dataviewid, 'q': q, 'filters': filters },
                    done: function (data) {
                        $('.dataview-board .records').removeClass('loading');

                        data.forEach(element => {
                            var record = JSON.parse(element);
                            var $content = $(loadrecord(record, $listtemplate.html()));
                            $content.find('[data-operation="viewdetail"]').on('click', function() {
                                var $open = $(this);
                                var modalresource = $open.data('modal');

                                if (modalresource) {
                                    modalresource.show();
                                    return;
                                }

                                var tpl = $singletemplate.html();
                                var detailview;

                                if (tpl.trim() != '') {
                                    detailview = loadrecord(record, tpl);
                                } else {
                                    record.wwwroot = wwwroot;
                                    record.cancreatetepuy = cancreatetepuy;
                                    detailview = Templates.render('mod_dataview/detail', record)
                                    .then(function(html, js) {
                                            var $html = $(html);
                                            $html.find('[data-operation="confirmgo"]').on('click', function(e) {
                                                e.preventDefault();
                                                $currentopenlink = $(this);
                                                createmessagemodal.show();
                                            });

                                            return $html;
                                        }
                                    );
                                }

                                ModalFactory.create({
                                    large: true,
                                    body: detailview
                                })
                                .then(function(modal) {
                                    modalresource = modal;
                                    modal.getModal().addClass('mod_dataview-record-modal');
                                    modal.show();

                                    $open.data('modal', modalresource);
                                });
                            });

                            $recordsboard.append($content);
                        });

                    },
                    fail: function (e) {
                        Notification.exception(e);
                        console.log(e);
                    }
                }]);
            });


        };

        return {
            init: init
        };
    });
