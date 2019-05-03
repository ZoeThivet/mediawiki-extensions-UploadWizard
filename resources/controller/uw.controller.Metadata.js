/*
 * This file is part of the MediaWiki extension UploadWizard.
 *
 * UploadWizard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * UploadWizard is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with UploadWizard.  If not, see <http://www.gnu.org/licenses/>.
 */

( function ( uw ) {
	/**
	 * Represents the metadata step in the wizard.
	 *
	 * @class
	 * @extends uw.controller.Step
	 * @param {mw.Api} api
	 * @param {Object} config UploadWizard config object.
	 */
	uw.controller.Metadata = function UWControllerDetails( api, config ) {
		uw.controller.Step.call(
			this,
			new uw.ui.Metadata(),
			api,
			config
		);

		this.stepName = 'metadata';

		this.ui.connect( this, { submit: 'onSubmit' } );
	};

	OO.inheritClass( uw.controller.Metadata, uw.controller.Step );

	/**
	 * Move to this step.
	 *
	 * @param {mw.UploadWizardUpload[]} uploads List of uploads being carried forward.
	 */
	uw.controller.Metadata.prototype.load = function ( uploads ) {
		var self = this,
			booklet = new OO.ui.BookletLayout( {
				expanded: false,
				outlined: true,
				classes: [ 'mwe-upwiz-metadata-booklet' ]
			} );

		uw.controller.Step.prototype.load.call( this, uploads );

		// show a spinner while the statement widgets are being created
		// (this could take a little time as it might involve API calls
		// to figure out the new pages' relevant entityIDs)
		this.ui.renderContent( $.createSpinner( { size: 'large', type: 'block' } ) );

		this.statementPromises = uploads.map( this.getStatementWidgetsForUpload );

		// don't render the booklet until the first page is ready
		this.statementPromises[ 0 ].then( function () {
			self.statementPromises.forEach( function ( statementPromise, i ) {
				statementPromise.then( function ( statements ) {
					var upload = uploads[ i ],
						content = new uw.MetadataContent( upload, statements ),
						page = new uw.MetadataPage( upload, { expanded: false, content: [ content ] } );

					booklet.addPages( [ page ], i );
				} );
			} );

			booklet.selectFirstSelectablePage();
			self.ui.renderContent( booklet.$element );
		} );
	};

	/**
	 * @param {mw.UploadWizardUpload} upload
	 * @return {jQuery.Promise}
	 */
	uw.controller.Metadata.prototype.getStatementWidgetsForUpload = function ( upload ) {
		return upload.details.getMediaInfoEntityId().then( function ( entityId ) {
			var statements = [];

			Object.keys( mw.config.get( 'wbmiProperties' ) ).forEach( function ( propertyId ) {
				var statement = new mw.mediaInfo.statements.StatementWidget( {
					entityId: entityId,
					propertyId: propertyId
				} );
				statements.push( statement );
			} );

			return statements;
		} );
	};

	uw.controller.Metadata.prototype.onSubmit = function () {
		return $.when.apply( $, this.statementPromises ).then( function () {
			return $.when.apply( $, [].slice.call( arguments ).map( function ( statements ) {
				var promise = $.Deferred().resolve().promise();

				// we can start submitting statements for multiple files at the same
				// time, but multiple statements per entity need to be submitted sequentially
				// (to avoid them being considered edit conflicts)
				statements.forEach( function ( statement ) {
					promise = promise.then( statement.submit.bind( statement ) );
					// submit statements, then make sure they remain in a mode
					// where they can't be edited
					promise.then( statement.setDisabled.bind( statement, true ) );
				} );

				return promise;
			} ) );
		} ).then( this.moveNext.bind( this ) );
	};

}( mw.uploadWizard ) );
