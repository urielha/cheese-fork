$(document).ready(function() {
    'use strict';

    var courses_hashmap = {};
    var courses_chosen = {};
    var color_hash = new ColorHash();

    function rishum_time_parse(time) {
        var match = /^(\d+)(:\d+)? - (\d+)(:\d+)?$/.exec(time);
        var start_hour = ('00' + match[1]).slice(-2);
        var start_minute = '00';
        if (match[2] !== undefined) {
            start_minute = (match[2] + '00').slice(1, 3);
        }
        var start = start_hour + ':' + start_minute;

        var end_hour = ('00' + match[3]).slice(-2);
        var end_minute = '00';
        if (match[4] !== undefined) {
            end_minute = (match[4] + '00').slice(1, 3);
        }
        var end = end_hour + ':' + end_minute;

        return {'start': start, 'end': end};
    }

    function rishum_exam_date_parse(date) {
        var match = /^בתאריך (\d+)\.(\d+)\.(\d+) /.exec(date);
        if (match === null) {
            return null;
        }
        return moment.utc(match[3] + '-' + match[2] + '-' + match[1] + 'T00:00:00');
    }

    function get_course_description(course) {
        var general = courses_hashmap[course].general;
        var text = general['מספר מקצוע'] + ' - ' + general['שם מקצוע'];

        if ('פקולטה' in general && general['פקולטה'].length > 0) {
            text += '\nפקולטה: ' + general['פקולטה'];
        }

        if ('נקודות' in general && general['נקודות'].length > 0) {
            var points = general['נקודות'];
            if (points.indexOf('.') < 0) {
                points += '.0';
            }
            text += '\nנקודות: ' + points;
        }

        if ('סילבוס' in general && general['סילבוס'].length > 0) {
            text += '\n\n' + general['סילבוס'];
        }

        if ('אחראים' in general && general['אחראים'].length > 0) {
            text += '\n\nאחראים: ' + general['אחראים'];
        }

        if ((('מועד א' in general) && general['מועד א'].length > 0) ||
            (('מועד ב' in general) && general['מועד ב'].length > 0)) {
            text += '\n';
            if (('מועד א' in general) && general['מועד א'].length > 0) {
                text += '\nמועד א\': ' + general['מועד א'];
            }
            if (('מועד ב' in general) && general['מועד ב'].length > 0) {
                text += '\nמועד ב\': ' + general['מועד ב'];
            }
        }

        if ('הערות' in general && general['הערות'].length > 0) {
            text += '\n\nהערות: ' + general['הערות'];
        }

        return text;
    }

    function string_hex_encode(str) {
        var result = "";
        for (var i=0; i<str.length; i++) {
            var hex = str.charCodeAt(i).toString(16);
            result += ("000"+hex).slice(-4);
        }
        return result;
    }

    function update_moed_exam_info(moed, div_content, span_exam_list, extra_courses) {
        var moed_names = ['מועד א', 'מועד ב'];
        var moed_name = moed_names[moed - 1];
        var moed_dates = {};

        Object.keys(courses_chosen).filter(function (course) {
            return courses_chosen[course];
        }).concat(extra_courses).forEach(function (course) {
            var general = courses_hashmap[course].general;
            if (moed_name in general) {
                var date = rishum_exam_date_parse(general[moed_name]);
                if (date !== null) {
                    moed_dates[course] = date;
                }
            }
        });

        var moed_courses = Object.keys(moed_dates);
        if (moed_courses.length === 0) {
            div_content.hide();
            return false;
        }

        div_content.show();

        moed_courses.sort(function (left_course, right_course) {
            var left = moed_dates[left_course];
            var right = moed_dates[right_course];
            var diff = left.diff(right);
            return diff !== 0 ? diff : left_course - right_course;
        });

        span_exam_list.html('');

        moed_courses.forEach(function (course, i) {
            var days_text = $('<span class="exam-days-item exam-days-item-course-' + course + '"></span>');
            var color = color_hash.hex(course);
            days_text.css('background-color', color);
            days_text.hover(
                function() {
                    $(this).addClass('exam-days-item-same-course-as-hovered');
                    change_course_previewed_status(course, true);
                    $('.list-group-item-course-' + course).addClass('list-group-item-same-course-as-hovered');
                }, function() {
                    $(this).removeClass('exam-days-item-same-course-as-hovered');
                    change_course_previewed_status(course, false);
                    $('.list-group-item-course-' + course).removeClass('list-group-item-same-course-as-hovered');
                }
            );

            var date = moed_dates[course].format('DD/MM');

            if (i === 0) {
                days_text.text(date);
                span_exam_list.append(days_text);
            } else {
                days_text
                    .prop('title', date)
                    .attr('data-toggle', 'tooltip')
                    .tooltip({
                        placement: (moed === 1 ? 'top' : 'bottom'),
                        template: '<div class="tooltip" role="tooltip"><div class="tooltip-inner"></div></div>'
                    });
                var left = moed_dates[moed_courses[i - 1]];
                var right = moed_dates[course];
                var diff = right.diff(left, 'days');
                days_text.text(diff);
                if (diff === 0) {
                    days_text.addClass('exam-days-item-conflicted');
                }
                //span_exam_list.append('🢀\u00AD');
                span_exam_list.append('<i class="exam-days-left-arrow"></i> ');
                span_exam_list.append(days_text);
            }
        });

        return true;
    }

    function update_exam_info(extra_courses) {
        var moed_a_added = update_moed_exam_info(1, $('#exams-moed-a'), $('#exams-moed-a-list'), extra_courses);
        var moed_b_added = update_moed_exam_info(2, $('#exams-moed-b'), $('#exams-moed-b-list'), extra_courses);

        if (moed_a_added || moed_b_added) {
            $('#exam-info').removeClass('d-none');
        } else {
            $('#exam-info').addClass('d-none');
        }
    }

    function update_course_conflicted_status(course) {
        var calendar = $('#calendar');

        var available_options_per_type = {};

        calendar.fullCalendar('clientEvents', function (event) {
            if (event.courseNumber !== course) {
                return false;
            }

            var type = event.lessonData['סוג'];
            if (!(type in available_options_per_type)) {
                available_options_per_type[type] = 0;
            }

            if (event.start.week() === 1) {
                available_options_per_type[type]++;
            }

            return false;
        });

        var conflicted = false;

        Object.keys(available_options_per_type).some(function (type) {
            if (available_options_per_type[type] === 0) {
                conflicted = true;
                return true;
            }
            return false;
        });

        if (conflicted) {
            $('.list-group-item-course-' + course).addClass('list-group-item-conflicted');
        } else {
            $('.list-group-item-course-' + course).removeClass('list-group-item-conflicted');
        }
    }

    function are_events_overlapping(event1, event2) {
        if (event1.start.day() !== event2.start.day()) {
            return false;
        }

        var start_time_1 = event1.start.clone().year(0).month(0).date(1);
        var end_time_1 = event1.end.clone().year(0).month(0).date(1);
        var start_time_2 = event2.start.clone().year(0).month(0).date(1);
        var end_time_2 = event2.end.clone().year(0).month(0).date(1);

        return start_time_1.isBefore(end_time_2) && end_time_1.isAfter(start_time_2);
    }

    function add_course_to_calendar(course) {
        var general = courses_hashmap[course].general;
        var schedule = courses_hashmap[course].schedule;
        if (schedule.length === 0) {
            return;
        }

        var calendar = $('#calendar');

        var lessons_added = {};
        var events = [];
        var has_conflicted = false;

        for (var i = 0; i < schedule.length; i++) {
            var lesson = schedule[i];
            if (lesson['מס.'] in lessons_added) {
                continue;
            }

            events.push(make_lesson_event(lesson));
            lessons_added[lesson['מס.']] = true;
        }

        calendar.fullCalendar('renderEvents', events);

        if (has_conflicted) {
            update_course_conflicted_status(course);
        }

        function make_lesson_event(lesson) {
            var lesson_day = lesson['יום'].charCodeAt(0) - 'א'.charCodeAt(0) + 1;
            var lesson_start_end = rishum_time_parse(lesson['שעה']);
            var event_start_end = {
                start: moment.utc('2017-01-0' + lesson_day + 'T' + lesson_start_end['start'] + ':00'),
                end: moment.utc('2017-01-0' + lesson_day + 'T' + lesson_start_end['end'] + ':00')
            };

            var title = lesson['סוג'] + ' ' + lesson['מס.'];
            if (lesson['בניין'] !== '') {
                title += '\n' + lesson['בניין'];
                if (lesson['חדר'] !== '') {
                    title += ' ' + lesson['חדר'];
                }
            }
            if (lesson['מרצה/מתרגל'] !== '') {
                title += '\n' + lesson['מרצה/מתרגל'];
            }
            title += '\n' + general['שם מקצוע'];

            // Hide conflicting events which cannot be selected.
            calendar.fullCalendar('clientEvents', function (cb_event) {
                if (cb_event.selected && are_events_overlapping(cb_event, event_start_end)) {
                    event_start_end.start.add(7, 'days');
                    event_start_end.end.add(7, 'days');
                    has_conflicted = true;
                }
                return false;
            });

            return {
                id: course + '.' + lesson['מס.'],
                title: title,
                start: event_start_end.start,
                end: event_start_end.end,
                backgroundColor: '#F8F9FA',
                textColor: 'black',
                borderColor: 'black',
                className: 'calendar-item-course-' + course
                + ' calendar-item-course-' + course + '-type-' + string_hex_encode(lesson['סוג'])
                + ' calendar-item-course-' + course + '-lesson-' + lesson['מס.'],
                courseNumber: course,
                lessonData: lesson,
                selected: false,
                temporary: false
            };
        }
    }

    function remove_course_from_calendar(course) {
        var calendar = $('#calendar');

        // Show conflicting events which can now be selected.
        var conflicted_events = calendar.fullCalendar('clientEvents', function (event) {
            if (event.courseNumber !== course && is_conflicted(event, course)) {
                return true;
            }

            return false;
        });

        var conflicted_courses = {};

        for (var i = 0; i < conflicted_events.length; i++) {
            conflicted_events[i].start.add(-7, 'days');
            conflicted_events[i].end.add(-7, 'days');
            conflicted_courses[conflicted_events[i].courseNumber] = true;
        }

        calendar.fullCalendar('updateEvents', conflicted_events);
        calendar.fullCalendar('removeEvents', function (event) {
            return event.courseNumber === course;
        });

        Object.keys(conflicted_courses).forEach(function (conflicted_course) {
            update_course_conflicted_status(conflicted_course);
        });

        // True if the event cannot be selected because of the given course.
        function is_conflicted(event, course) {
            var conflicting_event = calendar.fullCalendar('clientEvents', function (cb_event) {
                if (cb_event.courseNumber === course && cb_event.selected && are_events_overlapping(cb_event, event)) {
                    return true;
                }

                return false;
            });

            return conflicting_event.length > 0;
        }
    }

    function change_course_previewed_status(course, previewed) {
        var calendar = $('#calendar');
        if (previewed) {
            var conflicted_events = calendar.fullCalendar('clientEvents', function (event) {
                if (event.courseNumber === course && event.start.week() > 1) {
                    return true;
                }

                return false;
            });

            var temporary_events = [];

            for (var i = 0; i < conflicted_events.length; i++) {
                var conf = conflicted_events[i];
                var temp = {
                    id: 'temp_' + conf.id,
                    title: conf.title,
                    start: conf.start.clone().week(1),
                    end: conf.end.clone().week(1),
                    backgroundColor: conf.backgroundColor,
                    textColor: conf.textColor,
                    borderColor: conf.borderColor,
                    className: conf.className,
                    courseNumber: conf.courseNumber,
                    lessonData: conf.lessonData,
                    selected: conf.selected,
                    temporary: true
                };

                temporary_events.push(temp);
            }

            calendar.fullCalendar('renderEvents', temporary_events);

            $('.calendar-item-course-' + course).addClass('calendar-item-previewed');
        } else {
            $('.calendar-item-course-' + course).removeClass('calendar-item-previewed');
            calendar.fullCalendar('removeEvents', function (event) {
                return event.temporary;
            });
        }
    }

    function on_event_click(event) {
        var calendar = $('#calendar');

        var hide_conflicted_events;

        if (event.selected) {
            selected_lesson_unsave(event.courseNumber, event.lessonData['מס.']);
            event.backgroundColor = '#F8F9FA';
            event.textColor = 'black';
            event.borderColor = 'black';
            hide_conflicted_events = false;
        } else {
            selected_lesson_save(event.courseNumber, event.lessonData['מס.']);
            event.backgroundColor = color_hash.hex(event.courseNumber);
            event.textColor = 'white';
            event.borderColor = 'white';
            hide_conflicted_events = true;
        }
        event.selected = !event.selected;
        calendar.fullCalendar('updateEvent', event);

        var conflicted_events = calendar.fullCalendar('clientEvents', function (cb_event) {
            if (cb_event.id === event.id) {
                return false;
            }

            if (cb_event.courseNumber === event.courseNumber &&
                cb_event.lessonData['סוג'] === event.lessonData['סוג']) {
                return true;
            }

            return are_events_overlapping(cb_event, event);
        });

        var conflicted_courses = {};

        for (var i = 0; i < conflicted_events.length; i++) {
            conflicted_events[i].start.add(hide_conflicted_events ? 7 : -7, 'days');
            conflicted_events[i].end.add(hide_conflicted_events ? 7 : -7, 'days');
            conflicted_courses[conflicted_events[i].courseNumber] = true;
        }

        calendar.fullCalendar('updateEvents', conflicted_events);

        Object.keys(conflicted_courses).forEach(function (conflicted_course) {
            update_course_conflicted_status(conflicted_course);
        });
    }

    function on_event_mouseover(event, jsEvent) {
        $('.list-group-item-course-' + event.courseNumber).addClass('list-group-item-same-course-as-hovered');
        $('.exam-days-item-course-' + event.courseNumber).addClass('exam-days-item-same-course-as-hovered');
        $('.calendar-item-course-' + event.courseNumber).addClass('calendar-item-same-course-as-hovered');
        $('.calendar-item-course-' + event.courseNumber + '-type-' + string_hex_encode(event.lessonData['סוג'])).addClass('calendar-item-same-type-as-hovered');
    }

    function on_event_mouseout(event, jsEvent) {
        $('.list-group-item-course-' + event.courseNumber).removeClass('list-group-item-same-course-as-hovered');
        $('.exam-days-item-course-' + event.courseNumber).removeClass('exam-days-item-same-course-as-hovered');
        $('.calendar-item-course-' + event.courseNumber).removeClass('calendar-item-same-course-as-hovered');
        $('.calendar-item-course-' + event.courseNumber + '-type-' + string_hex_encode(event.lessonData['סוג'])).removeClass('calendar-item-same-type-as-hovered');
    }

    function after_event_render(event, element, view) {
        if (!event.selected) {
            var same_type = $('.calendar-item-course-' + event.courseNumber + '-type-' + string_hex_encode(event.lessonData['סוג']));
            if (same_type.length === 1) {
                element.addClass('calendar-item-last-choice');
            }
        }
    }

    function get_course_title(course) {
        var general = courses_hashmap[course].general;
        return general['מספר מקצוע'] + ' - ' + general['שם מקצוע'];
    }

    function on_course_button_click(button, course) {
        if (button.hasClass('active')) {
            remove_course_from_calendar(course);
            button.removeClass('active').removeClass('list-group-item-conflicted');
            button.css({ 'background-color': '', 'border-color': '' });
            selected_course_unsave(course);
            courses_chosen[course] = false;
            update_exam_info([]);
        } else {
            add_course_to_calendar(course);
            change_course_previewed_status(course, true);
            button.addClass('active');
            var color = color_hash.hex(course);
            button.css({ 'background-color': color, 'border-color': color });
            selected_course_save(course);
            courses_chosen[course] = true;
            update_exam_info([]);
        }
    }

    function add_course_to_list_group(course) {
        var button = $('<button type="button"'
            + ' class="list-group-item list-group-item-action active list-group-item-course-' + course + '">'
            + '</button>');
        var color = color_hash.hex(course);
        button.css({ 'background-color': color, 'border-color': color }).click(function () {
            $(this).tooltip('disable');
            on_course_button_click($(this), course);
        }).hover(
            function() {
                $(this).addClass('list-group-item-same-course-as-hovered');
                $('.exam-days-item-course-' + course).addClass('exam-days-item-same-course-as-hovered');
                change_course_previewed_status(course, true);
            }, function() {
                $(this).removeClass('list-group-item-same-course-as-hovered');
                $('.exam-days-item-course-' + course).removeClass('exam-days-item-same-course-as-hovered');
                change_course_previewed_status(course, false);
                $(this).tooltip('enable');
            }
        ).text(get_course_title(course))
            .prop('title', get_course_description(course).replace(/\n/g, '<br>'))
            .attr('data-toggle', 'tooltip')
            .tooltip({
                delay: { "show": 500, "hide": 0 },
                html: true,
                placement: 'bottom',
                animation: false,
                fallbackPlacement: 'clockwise',
                template: '<div class="tooltip" role="tooltip"><div class="arrow"></div><div class="tooltip-inner course-description-tooltip-inner"></div></div>',
                trigger: 'hover'
            });
        $('#course-button-list').append(button);
    }

    function selected_course_save(course) {
        var courses = JSON.parse(localStorage.getItem('courses') || '[]');
        courses.push(course);
        localStorage.setItem('courses', JSON.stringify(courses));
        localStorage.removeItem(course);
    }

    function selected_course_unsave(course) {
        var courses = JSON.parse(localStorage.getItem('courses') || '[]');
        courses = courses.filter(function (item) {
            return item !== course;
        });
        localStorage.setItem('courses', JSON.stringify(courses));
        localStorage.removeItem(course);
    }

    function selected_lesson_save(course, lesson) {
        var lessons = JSON.parse(localStorage.getItem(course) || '{}');
        lessons[lesson] = true;
        localStorage.setItem(course, JSON.stringify(lessons));
    }

    function selected_lesson_unsave(course, lesson) {
        var lessons = JSON.parse(localStorage.getItem(course) || '{}');
        delete lessons[lesson];
        localStorage.setItem(course, JSON.stringify(lessons));
    }

    function load_saved_courses_and_lessons() {
        var courses = JSON.parse(localStorage.getItem('courses') || '[]');
        courses.forEach(function (course) {
            if (!(course in courses_chosen) && (course in courses_hashmap)) {
                courses_chosen[course] = true;
                add_course_to_list_group(course);
                add_course_to_calendar(course);

                var lessons = JSON.parse(localStorage.getItem(course) || '{}');
                Object.keys(lessons).forEach(function (lesson) {
                    $('.calendar-item-course-' + course + '-lesson-' + lesson).click();
                });
            }
        });

        update_exam_info([]);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    courses_from_rishum.forEach(function (item) {
        var course_number = item.general['מספר מקצוע'];
        // Skip sport courses, which are not supported so well.
        if (course_number.slice(0, 2) !== '39') {
            courses_hashmap[course_number] = item;
            $('#select-course').append($('<option>', {
                value: course_number,
                text: course_number + ' - ' + item.general['שם מקצוע']
            }));
        }
    });

    $('#select-course').selectize({
        searchConjunction: 'or',
        maxOptions: null,
        onItemAdd: function (course) {
            if (!(course in courses_chosen)) {
                courses_chosen[course] = true;
                add_course_to_list_group(course);
                add_course_to_calendar(course);
                selected_course_save(course);
                update_exam_info([]);
            }
            this.clear();
        },
        onDropdownItemActivate: function (course) {
            if (!(course in courses_chosen)) {
                add_course_to_calendar(course);
                update_exam_info([course]);
                $('.exam-days-item-course-' + course).addClass('exam-days-item-same-course-as-hovered');
            }
            change_course_previewed_status(course, true);
        },
        onDropdownItemDeactivate: function (course) {
            if (!(course in courses_chosen)) {
                remove_course_from_calendar(course);
                update_exam_info([]);
            } else {
                // Remove highlight
                change_course_previewed_status(course, false);
            }
        }
    });

    $('#calendar').fullCalendar({
        defaultDate: '2017-01-01',
        //editable: true,
        //eventLimit: true, // allow "more" link when too many events
        defaultView: 'agendaWeek',
        header: false,
        allDaySlot: false,
        minTime: '08:00:00',
        maxTime: '18:30:00',
        hiddenDays: [ 5, 6 ],
        height: 'auto',
        contentHeight: 'auto',
        columnFormat: 'dddd',
        locale: 'he',
        slotEventOverlap: false,
        displayEventTime: false,
        eventClick: on_event_click,
        eventMouseover: on_event_mouseover,
        eventMouseout: on_event_mouseout,
        eventAfterRender: after_event_render
    });

    $('#right-content-bar').removeClass('invisible');
    load_saved_courses_and_lessons();
    $('#page-loader').hide();
});
